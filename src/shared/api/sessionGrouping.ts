// Agrupación de series en sesiones. Lógica pura, sin I/O.
//
// Vive aparte de `queries.ts` a propósito: aquel importa el cliente de Supabase,
// que se construye al cargar el módulo y necesita VITE_SUPABASE_URL/KEY y
// `window.localStorage`. Probar esta función desde allí obligaba a jsdom y a
// tener las variables de entorno puestas — en CI no las hay y la suite se caía
// entera. La parte que se puede equivocar (huecos de fecha, orden, recorte) no
// necesita ni red ni navegador.

import { toLocalDateKey } from '@shared/lib/dateKeys';

/** Una sesión pasada de un ejercicio, con el esfuerzo que se registró. */
export interface ExerciseSessionSets {
  started_at: string;
  sets: { weight: number; reps: number; rir: number | null; rpe: number | null }[];
}

/**
 * Agrupa las series de un ejercicio en sesiones, **una por día de entreno**.
 *
 * No por entreno: GymLog guarda un workout por ejercicio, así que un mismo día
 * puede tener varios workouts del mismo ejercicio. Agrupando por workout, «la
 * última sesión» acababa siendo el accesorio ligero del final del día —o un
 * guardado duplicado— y la sugerencia de carga se desplomaba: el 11-ago había
 * Press militar a 57,5 kg × 6 por la mañana y a 40 kg × 10 después, y el motor
 * proponía sobre 40 kg. Con el día entero como sesión, `topSet` se queda con la
 * serie más pesada, que es el peso de trabajo real.
 *
 * El día se calcula en hora **local**: en UTC un entreno de noche se iría al día
 * siguiente y se partiría en dos sesiones.
 */
export const groupSetsBySession = (
  sets: {
    workout_id: string;
    weight: number;
    reps: number;
    rir: number | null;
    rpe: number | null;
  }[],
  workouts: { id: string; started_at: string | null }[],
  sessionLimit: number,
): ExerciseSessionSets[] => {
  const startedAt = new Map(workouts.map((w) => [w.id, w.started_at]));
  const byDay = new Map<string, ExerciseSessionSets>();

  for (const s of sets) {
    // Un entreno sin fecha no se puede ordenar ni medir: fuera. Sin esto, el
    // motor calcularía huecos entre sesiones con una fecha inventada.
    const date = startedAt.get(s.workout_id);
    if (!date) continue;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) continue;

    const dayKey = toLocalDateKey(parsed);
    const entry = { weight: s.weight, reps: s.reps, rir: s.rir, rpe: s.rpe };
    const session = byDay.get(dayKey);

    if (!session) {
      byDay.set(dayKey, { started_at: date, sets: [entry] });
      continue;
    }
    session.sets.push(entry);
    // La sesión se marca con el inicio más temprano del día: es cuando empezó
    // a entrenar, no cuando guardó el último ejercicio.
    if (date.localeCompare(session.started_at) < 0) session.started_at = date;
  }

  // Más reciente primero, igual que el resto de consultas de historial.
  return [...byDay.values()]
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, sessionLimit);
};
