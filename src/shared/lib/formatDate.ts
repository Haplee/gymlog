/**
 * Fecha de display corta en español (p. ej. "10/7/2026").
 * Unifica los `new Date(x).toLocaleDateString()` dispersos por las páginas.
 * La app es solo en español (ver CLAUDE.md), por eso el locale es fijo 'es'.
 */
export function formatDisplayDate(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toLocaleDateString('es');
}

/**
 * Fecha de calendario (yyyy-mm-dd) en formato corto: «1 sep».
 *
 * Se parte a mano en vez de `new Date('2026-09-01')`: esa cadena la interpreta
 * el motor como UTC, y al pintarla en hora local salia el dia anterior.
 */
export function formatShortDay(day: string, locale = 'es'): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
