interface ShareWorkoutParams {
  exerciseCount: number;
  totalSets: number;
  totalVolume: number;
  date?: string;
}

export async function shareWorkout({
  exerciseCount,
  totalSets,
  totalVolume,
  date,
}: ShareWorkoutParams): Promise<boolean> {
  const text = `Entrené ${date || 'hoy'} — ${exerciseCount} ejercicios, ${totalSets} series, ${totalVolume.toLocaleString()} kg de volumen total`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'GymLog',
        text,
      });
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('[Share] Error:', err);
      }
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    console.error('[Share] No se pudo copiar al portapapeles');
    return false;
  }
}
