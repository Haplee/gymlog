export interface VolumeProjection {
  /** Pendiente de la regresión lineal (volumen por periodo). */
  slope: number;
  /** Volumen proyectado para el siguiente periodo (no negativo). */
  projected: number;
  trend: 'up' | 'down' | 'flat';
}

/**
 * Regresión lineal por mínimos cuadrados sobre una serie de volúmenes
 * (índice 0..n-1 como x) y proyección del siguiente punto.
 * Devuelve null con menos de 2 puntos.
 */
export function projectNextVolume(series: number[]): VolumeProjection | null {
  const n = series.length;
  if (n < 2) return null;

  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (series[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  const projected = Math.max(0, Math.round(slope * n + intercept));

  // Umbral de "plano": pendiente menor al 2% de la media.
  const flatThreshold = Math.abs(yMean) * 0.02;
  const trend: VolumeProjection['trend'] =
    slope > flatThreshold ? 'up' : slope < -flatThreshold ? 'down' : 'flat';

  return { slope, projected, trend };
}
