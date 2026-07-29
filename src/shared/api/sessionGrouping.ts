// Agrupación de series en sesiones. Lógica pura, sin I/O.
//
// Vive aparte de `queries.ts` a propósito: aquel importa el cliente de Supabase,
// que se construye al cargar el módulo y necesita VITE_SUPABASE_URL/KEY y
// `window.localStorage`. Probar esta función desde allí obligaba a jsdom y a
// tener las variables de entorno puestas — en CI no las hay y la suite se caía
// entera. La parte que se puede equivocar (huecos de fecha, orden, recorte) no
// necesita ni red ni navegador.

/** Una sesión pasada de un ejercicio, con el esfuerzo que se registró. */
export interface ExerciseSessionSets {
  started_at: string;
  sets: { weight: number; reps: number; rir: number | null; rpe: number | null }[];
}

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
  const byWorkout = new Map<string, ExerciseSessionSets>();

  for (const s of sets) {
    // Un entreno sin fecha no se puede ordenar ni medir: fuera. Sin esto, el
    // motor calcularía huecos entre sesiones con una fecha inventada.
    const date = startedAt.get(s.workout_id);
    if (!date) continue;
    const session = byWorkout.get(s.workout_id);
    const entry = { weight: s.weight, reps: s.reps, rir: s.rir, rpe: s.rpe };
    if (session) session.sets.push(entry);
    else byWorkout.set(s.workout_id, { started_at: date, sets: [entry] });
  }

  // Más reciente primero, igual que el resto de consultas de historial.
  return [...byWorkout.values()]
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, sessionLimit);
};
