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

/**
 * Suma (o resta, con `days` negativo) días a una clave YYYY-MM-DD.
 *
 * Opera en UTC a propósito: la clave no lleva hora, así que sumar en local
 * podría devolver el mismo día en los cambios de horario. Con una entrada
 * inválida se devuelve tal cual: quien la usa ya está ensanchando un rango y
 * prefiere no romper la consulta por una fecha rara.
 */
export function shiftDateKey(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
