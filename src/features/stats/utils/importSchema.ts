// Validación del JSON de importación de historial.
//
// Es la frontera más expuesta de la app: un fichero que viene de fuera y acaba
// escribiendo en la base de datos. Hasta ahora se leía a base de
// `as Record<string, unknown>` y `Number(x) || 0`, así que un campo corrupto no
// fallaba: se convertía en un 0 y entraba igual, ensuciando el historial de
// forma silenciosa.
//
// Aquí se valida una sola vez y se devuelve una estructura ya normalizada, para
// que el resto del flujo (previsualización y escritura) trabaje con datos
// tipados en vez de repetir las mismas coacciones en dos sitios.

import { z } from 'zod';

/** Topes de cordura: fuera de esto no es un dato de entreno, es basura. */
const MAX_REPS = 1000;
const MAX_WEIGHT_KG = 2000;

const ImportedSetSchema = z.object({
  exercise: z.string().trim().min(1),
  reps: z.coerce.number().finite().positive().max(MAX_REPS),
  weight: z.coerce.number().finite().nonnegative().max(MAX_WEIGHT_KG).catch(0),
  set_num: z.coerce.number().int().positive().nullish().catch(null),
  is_warmup: z.coerce.boolean().catch(false),
  notes: z.string().catch(''),
  rpe: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v == null ? '' : String(v)))
    .catch(''),
});

export type ImportedSet = z.infer<typeof ImportedSetSchema>;

const ImportedWorkoutSchema = z.object({
  started_at: z.string().nullish(),
  finished_at: z.string().nullish(),
  sets: z.array(z.unknown()).nullish(),
});

export interface ImportedWorkout {
  startedAt: string;
  finishedAt: string;
  /** Fecha `YYYY-MM-DD` derivada de `startedAt`. Es la clave del dedupe. */
  date: string;
  /** Series ya agrupadas por ejercicio: la RPC guarda un ejercicio por llamada. */
  byExercise: Map<string, ImportedSet[]>;
}

export interface ParsedImport {
  workouts: ImportedWorkout[];
  /** Series descartadas por no validar. Se enseña al usuario, no se esconde. */
  droppedSets: number;
  /** Entrenos descartados por quedarse sin ninguna serie válida. */
  droppedWorkouts: number;
}

/**
 * Normaliza el array de entrenos de un JSON importado.
 *
 * Nunca lanza: un fichero con forma inesperada devuelve cero entrenos, y las
 * filas sueltas que no validan se cuentan aparte para poder avisar.
 */
export function parseImportedWorkouts(raw: unknown, now: Date = new Date()): ParsedImport {
  const rows = z.array(z.unknown()).safeParse(raw ?? []);
  if (!rows.success) return { workouts: [], droppedSets: 0, droppedWorkouts: 0 };

  const workouts: ImportedWorkout[] = [];
  let droppedSets = 0;
  let droppedWorkouts = 0;

  for (const rawWorkout of rows.data) {
    const parsed = ImportedWorkoutSchema.safeParse(rawWorkout);
    if (!parsed.success) {
      droppedWorkouts++;
      continue;
    }

    const startedAt = parsed.data.started_at?.trim() || now.toISOString();
    const finishedAt = parsed.data.finished_at?.trim() || startedAt;

    const byExercise = new Map<string, ImportedSet[]>();
    for (const rawSet of parsed.data.sets ?? []) {
      const set = ImportedSetSchema.safeParse(rawSet);
      if (!set.success) {
        droppedSets++;
        continue;
      }
      const group = byExercise.get(set.data.exercise) ?? [];
      group.push(set.data);
      byExercise.set(set.data.exercise, group);
    }

    if (byExercise.size === 0) {
      droppedWorkouts++;
      continue;
    }

    workouts.push({
      startedAt,
      finishedAt,
      date: startedAt.split('T')[0],
      byExercise,
    });
  }

  return { workouts, droppedSets, droppedWorkouts };
}
