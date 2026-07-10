/**
 * Formatea una duración en segundos como texto compacto (p. ej. "1h 30m", "45min").
 * Fuente única: antes estaba duplicada en CardioPage y HistoryPage.
 */
export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}
