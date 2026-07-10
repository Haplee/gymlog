/**
 * Fecha de display corta en español (p. ej. "10/7/2026").
 * Unifica los `new Date(x).toLocaleDateString()` dispersos por las páginas.
 * La app es solo en español (ver CLAUDE.md), por eso el locale es fijo 'es'.
 */
export function formatDisplayDate(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toLocaleDateString('es');
}
