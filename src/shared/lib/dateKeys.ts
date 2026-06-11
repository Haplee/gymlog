/**
 * Clave de fecha YYYY-MM-DD en zona horaria LOCAL del usuario.
 * No usar toISOString() para agrupar por día: convierte a UTC y
 * desplaza entrenos nocturnos al día anterior/siguiente.
 */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
