// Validación en runtime de lo que devuelve la BD.
//
// Hasta ahora la respuesta de `get_workouts_with_sets` entraba en la app con
// `as unknown as WorkoutWithSets`: la doble aserción que apaga por completo el
// chequeo de tipos. Si la RPC cambiaba de forma, el fallo no aparecía aquí sino
// tres pantallas más allá, como un `undefined` en mitad de un gráfico.
//
// Criterio de diseño: **validar no puede hacer desaparecer datos que hoy
// funcionan**. Por eso los esquemas son permisivos con lo que la BD deja nulo
// y usan `passthrough`, para que añadir una columna no invalide la fila. Solo
// se descarta lo que la app no podría pintar de ninguna manera (una serie sin
// reps o sin peso), y se avisa por consola de cuántas se cayeron.

import { z } from 'zod';
import { devWarn } from '@shared/lib/devtools';
import type { WorkoutWithSets, WorkoutSetWithDetails } from '@shared/lib/types';

/**
 * Serie tal y como la sirve la RPC.
 *
 * `exercise` es nullish a propósito: el join con `exercises` es LEFT, así que
 * un ejercicio borrado deja la serie sin nombre. Eso no es corrupción, es un
 * caso real que la app ya sabe pintar como «Desconocido».
 */
export const RemoteWorkoutSetSchema = z
  .object({
    id: z.string(),
    reps: z.number(),
    weight: z.number(),
    set_num: z.number().nullish(),
    exercise_id: z.string().nullish(),
    workout_id: z.string().nullish(),
    created_at: z.string().nullish(),
    notes: z.string().nullish(),
    is_warmup: z.boolean().nullish(),
    rpe: z.number().nullish(),
    rir: z.number().nullish(),
    exercise: z
      .object({ name: z.string().nullish(), muscle_group: z.string().nullish() })
      .nullish(),
    workout: z.object({ started_at: z.string().nullish() }).nullish(),
  })
  .passthrough();

/**
 * Un campo que la BD declara `T | null`. Se acepta que falte en el payload y se
 * normaliza a `null`, que es lo que promete el tipo generado por `gen:types`.
 */
const nullable = <T extends z.ZodTypeAny>(inner: T) =>
  inner.nullish().transform((v: z.infer<T> | null | undefined) => v ?? null);

/**
 * Entreno tal y como lo sirve la RPC: fila de `workouts` (via `to_jsonb`) con
 * los `sets` anidados.
 *
 * Se enumeran todas las columnas a propósito, aunque sea más verboso: es lo que
 * permite que el objeto validado satisfaga `WorkoutWithSets` de verdad, sin
 * aserción de por medio. `passthrough` deja pasar columnas nuevas sin invalidar
 * la fila, así que añadir una a la tabla no rompe nada aquí.
 */
export const RemoteWorkoutSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    started_at: nullable(z.string()),
    finished_at: nullable(z.string()),
    client_id: nullable(z.string()),
    name: nullable(z.string()),
    notes: nullable(z.string()),
    status: nullable(z.string()),
    rating: nullable(z.number()),
    duration_seconds: nullable(z.number()),
    total_volume_kg: nullable(z.number()),
    sets: z.array(z.unknown()).nullish(),
  })
  .passthrough();

/**
 * Convierte una fila validada al tipo que consume la app.
 *
 * El nombre vacío es deliberado: `WorkoutSetWithDetails` promete `name: string`
 * y la BD puede no tenerlo. Normalizarlo aquí evita mentirle al tipo, y aguas
 * abajo el nombre vacío ya cae en el «Desconocido» de siempre por ser falsy.
 */
function toSetWithDetails(raw: z.infer<typeof RemoteWorkoutSetSchema>): WorkoutSetWithDetails {
  return {
    ...raw,
    exercise: {
      name: raw.exercise?.name ?? '',
      ...(raw.exercise?.muscle_group ? { muscle_group: raw.exercise.muscle_group } : {}),
    },
    workout: { started_at: raw.workout?.started_at ?? null },
  } as WorkoutSetWithDetails;
}

/**
 * Valida la respuesta completa de la RPC y descarta lo inservible.
 *
 * Devuelve siempre un array: una respuesta con forma inesperada deja la
 * pantalla vacía, nunca la rompe.
 */
export function parseRemoteWorkouts(data: unknown): WorkoutWithSets[] {
  const rows = z.array(z.unknown()).safeParse(data ?? []);
  if (!rows.success) {
    devWarn('[schemas] respuesta de get_workouts_with_sets con forma inesperada');
    return [];
  }

  let droppedWorkouts = 0;
  let droppedSets = 0;

  const workouts = rows.data.flatMap((rawWorkout): WorkoutWithSets[] => {
    const workout = RemoteWorkoutSchema.safeParse(rawWorkout);
    if (!workout.success) {
      droppedWorkouts++;
      return [];
    }

    const sets = (workout.data.sets ?? []).flatMap((rawSet): WorkoutSetWithDetails[] => {
      const parsed = RemoteWorkoutSetSchema.safeParse(rawSet);
      if (!parsed.success) {
        droppedSets++;
        return [];
      }
      return [toSetWithDetails(parsed.data)];
    });

    // Sin aserción: el esquema ya garantiza cada campo que `WorkoutWithSets`
    // exige. `ended_at` es el nombre que usa la app para `finished_at`.
    const { finished_at, ...rest } = workout.data;
    return [{ ...rest, ended_at: finished_at, sets }];
  });

  if (droppedWorkouts || droppedSets) {
    devWarn(
      `[schemas] descartados por no validar: ${droppedWorkouts} entrenos, ${droppedSets} series`,
    );
  }

  return workouts;
}
