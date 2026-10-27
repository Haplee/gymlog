import { create } from 'zustand';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devError } from '@shared/lib/devtools';
import { enqueueWorkout, type OutboxSet } from '@shared/lib/workoutOutbox';
import { saveWorkoutOrQueue } from '@shared/lib/saveWorkout';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { normalizeExerciseName } from '@shared/lib/progressionCycle';
import type { DayOfWeek, DayRoutine, Routine } from './routineStore';
import { planDurationOf, planModeOf } from '../utils/planTarget';
import { totalFromPerSide } from '@shared/lib/perSide';
import {
  parseDurationSeconds,
  parseReps,
  parseSetWeight,
} from '@features/workout/lib/setValidation';
import { isIdempotencyConflict } from '@shared/lib/idempotency';

export interface SessionSet {
  id: string;
  reps: string;
  weight: string;
  /**
   * Esfuerzo percibido (RPE) de la serie, 6–10. Vacío = no lo marcó.
   *
   * Antes esta pantalla mandaba `rpe: ''` siempre, así que quien entrenaba por
   * rutina no registraba esfuerzo nunca. Sin esfuerzo el motor se niega a
   * autorregular y la descarga no llega a proponerse jamás, por mucho que el
   * volumen suba: `suggestDeload` exige ver el RIR cayendo.
   */
  rpe: string;
  /**
   * El usuario ha escrito el peso a mano.
   *
   * Lo que sugiere el motor se precarga solo, pero no puede pisar una
   * corrección: si alguien baja de 82,5 a 80 porque hoy no salía, guardar 82,5
   * sería guardar la recomendación en vez del entrenamiento.
   */
  weightTouched?: boolean;
  /** Segundos aguantados. Vacío en una serie de repeticiones. */
  durationSeconds: string;
  /**
   * El usuario ha editado esta fila (reps, peso o segundos).
   *
   * Las filas nacen del plan con las repeticiones objetivo ya puestas, así que
   * tener repeticiones no significa haber hecho la serie. Sin esta marca,
   * guardar una rutina de 4×8 a medio hacer registraba las cuatro series del
   * plan aunque solo se hubiera tocado una. Las que se quedan con el objetivo
   * intacto no se envían.
   */
  touched?: boolean;
}

export interface SessionExercise {
  /** Nombre tal cual figura en la rutina; se resuelve a exercise_id al guardar. */
  name: string;
  /** Objetivo de la plantilla, solo informativo en la UI. */
  targetSets?: number;
  targetReps?: string;
  /**
   * Cómo se registra, copiado del plan al empezar la sesión.
   *
   * Se copia en vez de leerse de la rutina en cada render porque la sesión debe
   * sobrevivir a que el usuario edite la rutina a mitad: lo que se está
   * registrando es el plan de cuando se pulsó «empezar», no el de ahora.
   */
  mode?: 'reps' | 'time';
  perSide?: boolean;
  /** Segundos objetivo por serie cuando `mode === 'time'`. */
  targetDurationSeconds?: number;
  /** Grupo de superserie copiado del plan. Ver `RoutineExercise.supersetId`. */
  supersetId?: string;
  /**
   * Clave de idempotencia del guardado de este ejercicio.
   *
   * Se fija la primera vez que se intenta guardar y se persiste con la sesión:
   * si el envío falla —o la app se cierra a mitad— el reintento manda la misma
   * y el servidor reconoce el reenvío. Las sesiones guardadas por versiones
   * anteriores no la traen y se les asigna al vuelo.
   */
  clientId?: string;
  /**
   * Este ejercicio ya está escrito en el servidor (o en la cola) en un intento
   * anterior de terminar la sesión.
   *
   * Un fallo a mitad de `finish` dejaba la sesión entera pendiente, así que el
   * reintento reenviaba también los ejercicios que ya se habían guardado. Con la
   * misma clave y la misma huella el servidor lo tolera, pero si algo cambiaba
   * —la hora de cierre, una corrección— respondía `idempotency_conflict` y la
   * rutina no se podía terminar nunca. Marcarlos permite saltarlos.
   */
  savedAt?: string;
  sets: SessionSet[];
}

export interface RoutineSessionResult {
  error: Error | null;
  success: boolean;
  queued?: boolean;
  /** Nº de ejercicios con al menos una serie válida que se han registrado. */
  savedExercises: number;
  /**
   * Series escritas que se han quedado fuera por estar a medias.
   *
   * Se descartaban en silencio: quien anotaba cuatro series y dejaba una sin
   * peso guardaba tres y no se enteraba hasta mirar el historial.
   */
  droppedSets: number;
  /**
   * Nombres de los ejercicios escritos en el servidor **en este intento**.
   *
   * La progresión se registra solo para estos: incluir los que ya estaban
   * guardados de un intento anterior avanzaría el ciclo dos veces por la misma
   * sesión.
   */
  savedExerciseNames: string[];
}

interface RoutineSessionState {
  routineId: string | null;
  routineName: string;
  dayName: string;
  day: DayOfWeek | null;
  startedAt: string | null;
  /**
   * Hora de cierre congelada en el primer intento de `finish`.
   *
   * Forma parte de la huella que el servidor guarda con el `client_id`. Si se
   * regenerara en cada reintento, el mismo envío parecería otro contenido y el
   * servidor lo rechazaría con `idempotency_conflict`.
   */
  finishedAt: string | null;
  exercises: SessionExercise[];
  saving: boolean;

  isActive: () => boolean;
  /**
   * @param prefills Pesos a precargar por nombre normalizado de ejercicio
   *   (auto-relleno). Las filas quedan con ese peso ya escrito, listas para
   *   ajustar o registrar directamente.
   */
  start: (
    routine: Routine,
    day: DayOfWeek,
    dayRoutine: DayRoutine,
    prefills?: Record<string, string>,
  ) => void;
  addSet: (exerciseIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, data: Partial<SessionSet>) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  /**
   * Escribe el peso recomendado en las series que el usuario no haya tocado.
   *
   * Antes esto no existía y el relleno ocurría al pulsar «Completar»: se
   * machacaban **todas** las series con la recomendación y se guardaba eso, así
   * que el historial recogía lo que la app propuso y no lo que se levantó. Con
   * el peso ya escrito en la fila, quien haga otra cosa lo corrige y su
   * corrección manda.
   */
  prefillAdvisedWeight: (exerciseName: string, weight: string) => void;
  /** Marca el mismo RPE en todas las series de un ejercicio. */
  setExerciseRpe: (exerciseIndex: number, rpe: string) => void;
  /**
   * Reemplaza la lista de ejercicios. La usa la sesión de rutina en su modo
   * de autocompletado para rellenar el peso recomendado en cada serie antes
   * de `finish`, sin que el usuario tenga que teclear nada.
   */
  setExercises: (exercises: SessionExercise[]) => void;
  discard: () => void;
  /**
   * Guarda la sesión completa. `resolveExerciseId` mapea el nombre de la rutina
   * al id del catálogo (propio o público); si devuelve null se crea como custom.
   * `toKg` convierte el peso tecleado (unidad de display) a kg, que es como lo
   * almacena la BD.
   */
  finish: (
    userId: string,
    resolveExerciseId: (name: string) => string | null,
    toKg: (weight: number) => number,
  ) => Promise<RoutineSessionResult>;
}

const makeSet = (reps = '', weight = '', durationSeconds = ''): SessionSet => ({
  id: crypto.randomUUID(),
  reps,
  weight,
  rpe: '',
  durationSeconds,
});

/** Campos cuya edición convierten la fila del plan en una fila registrada. */
const INTENT_FIELDS = ['reps', 'weight', 'durationSeconds'] as const;

/** Campos que forman parte de lo guardado: cambiarlos invalida un guardado previo. */
const CONTENT_FIELDS = [...INTENT_FIELDS, 'rpe'] as const;

/**
 * Repeticiones objetivo de la plantilla como valor inicial de la fila.
 *
 * La rutina ya dice cuántas repeticiones toca, así que empezar con las filas
 * en blanco obligaba a teclear lo mismo una vez por serie: en un 4×5 son cuatro
 * cincos a mano antes de poder registrar nada.
 *
 * Se coge el primer número del texto porque el campo es libre y admite desde
 * «5» hasta «8-10», «10 por pierna» o «30-45s». En un rango se propone el
 * extremo bajo: es el valor que el usuario baja o sube, pero nunca uno que no
 * haya hecho. Si no hay número (por ejemplo «al fallo») se deja vacío.
 */
function targetRepsValue(reps?: string): string {
  const match = reps?.trim().match(/^\d+/);
  return match ? match[0] : '';
}

/**
 * Objetivo que se precarga en la fila, ya en **total**.
 *
 * El plan se escribe por lado —«3 × 12 por lado» es lo que el usuario teclea y
 * lo que se imprime— y lo que se guarda es el total, para que dentro de seis
 * meses un «12» del historial no sea ambiguo. Aquí es donde se cruzan las dos
 * convenciones, y por eso la conversión está en una función con nombre y no
 * escrita en línea.
 */
function objetivoDeReps(reps: string | undefined, perSide?: boolean): string {
  const base = targetRepsValue(reps);
  if (!base) return '';
  return String(totalFromPerSide(Number(base), perSide));
}

/** Segundos válidos de la serie, o `null` si no se mide en tiempo. */
function segundosDe(s: SessionSet): number | null {
  return parseDurationSeconds(s.durationSeconds);
}

/** Repeticiones válidas de la serie, o `null` si no se miden. */
function repsDe(s: SessionSet): number | null {
  return parseReps(s.reps);
}

/**
 * Una serie cuenta si mide algo —repeticiones o segundos— y el peso es válido.
 *
 * Una serie sin lastre pesa 0 y vale: exigirle un peso positivo dejaba fuera
 * justo el caso normal de los ejercicios a peso corporal. El peso vacío no es
 * un dato que falte, es «no hay lastre».
 */
function isValidSet(s: SessionSet): boolean {
  if (repsDe(s) == null && segundosDe(s) == null) return false;
  return parseSetWeight(s.weight) != null;
}

/**
 * ¿Esta fila la estaba usando el usuario?
 *
 * No vale mirar las repeticiones: el plan las precarga con su objetivo, así que
 * las filas nacen con un número puesto y quedarse cortas de series —planear
 * cuatro y hacer tres— es lo normal, no una pérdida. Lo que delata una serie de
 * verdad es que se haya editado (`touched`), o que tenga peso o segundos, que
 * solo aparecen si alguien los escribe.
 */
function pareceIntencionada(s: SessionSet): boolean {
  return !!(s.touched || s.weight.trim() || (s.durationSeconds ?? '').trim());
}

function toOutboxSets(sets: SessionSet[], toKg: (w: number) => number): OutboxSet[] {
  return sets
    .filter((s) => pareceIntencionada(s) && isValidSet(s))
    .map((s, i) => {
      const segundos = segundosDe(s);
      const peso = parseSetWeight(s.weight) ?? 0;
      return {
        set_num: i + 1,
        // `null`, no `0`: la BD distingue «no se mide así» de «hizo cero».
        reps: repsDe(s),
        weight: toKg(peso),
        is_warmup: false,
        notes: '',
        rpe: s.rpe ?? '',
        set_type: 'normal',
        ...(segundos != null ? { duration_seconds: segundos } : {}),
      };
    });
}

const emptySession = {
  routineId: null,
  routineName: '',
  dayName: '',
  day: null,
  startedAt: null,
  finishedAt: null,
  exercises: [] as SessionExercise[],
  saving: false,
};

export const useRoutineSessionStore = create<RoutineSessionState>()(
  persist(
    (set, get) => ({
      ...emptySession,

      isActive: () => get().startedAt !== null && get().exercises.length > 0,

      start: (routine, day, dayRoutine, prefills) => {
        set({
          routineId: routine.id,
          routineName: routine.name,
          dayName: dayRoutine.name,
          day,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          saving: false,
          exercises: dayRoutine.exercises.map((ex) => {
            const modo = planModeOf(ex);
            const duracion = planDurationOf(ex);
            return {
              name: ex.name,
              targetSets: ex.sets,
              targetReps: ex.reps,
              ...(modo === 'time' ? { mode: 'time' as const } : {}),
              ...(ex.perSide ? { perSide: true } : {}),
              ...(duracion != null ? { targetDurationSeconds: duracion } : {}),
              ...(ex.supersetId ? { supersetId: ex.supersetId } : {}),
              // Una fila por serie objetivo, ya con el objetivo puesto: así
              // registrar la rutina tal cual sale es solo escribir los pesos. Si
              // hay auto-relleno, el peso de la última sesión ya viene escrito.
              // En modo tiempo lo que se precarga son los segundos del plan, no
              // las repeticiones: `targetReps` puede traer un «30-45s» viejo
              // escrito a mano y tomarlo por repeticiones sería inventarse 30.
              sets: Array.from({ length: Math.max(1, ex.sets ?? 1) }, () =>
                makeSet(
                  modo === 'time' ? '' : objetivoDeReps(ex.reps, ex.perSide),
                  prefills?.[normalizeExerciseName(ex.name)] ?? '',
                  duracion != null ? String(duracion) : '',
                ),
              ),
            };
          }),
        });
      },

      addSet: (exerciseIndex) => {
        const exercises = get().exercises.map((ex, i) => {
          if (i !== exerciseIndex) return ex;
          const last = ex.sets.at(-1);
          return {
            ...ex,
            sets: [
              ...ex.sets,
              // Una serie añadida a mano es del usuario desde el primer
              // momento, aunque nazca copiando la anterior.
              {
                ...makeSet(last?.reps ?? '', last?.weight ?? '', last?.durationSeconds ?? ''),
                touched: true,
              },
            ],
            // Si el ejercicio ya se guardó en un intento anterior, esta serie
            // es una corrección: se guarda como entreno nuevo.
            ...(ex.savedAt ? { savedAt: undefined, clientId: undefined } : {}),
          };
        });
        set({ exercises });
      },

      updateSet: (exerciseIndex, setIndex, data) => {
        const cambiaContenido = CONTENT_FIELDS.some((k) => k in data);
        const toca = INTENT_FIELDS.some((k) => k in data);
        const exercises = get().exercises.map((ex, i) => {
          if (i !== exerciseIndex) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s, j) =>
              j === setIndex ? { ...s, ...data, ...(toca ? { touched: true } : {}) } : s,
            ),
            // Corregir un ejercicio ya escrito no puede reutilizar su clave: el
            // servidor la vería como el mismo envío con otro contenido.
            ...(cambiaContenido && ex.savedAt ? { savedAt: undefined, clientId: undefined } : {}),
          };
        });
        set({ exercises });
      },

      removeSet: (exerciseIndex, setIndex) => {
        const exercises = get().exercises.map((ex, i) => {
          if (i !== exerciseIndex) return ex;
          return {
            ...ex,
            sets: ex.sets.filter((_, j) => j !== setIndex),
            ...(ex.savedAt ? { savedAt: undefined, clientId: undefined } : {}),
          };
        });
        set({ exercises });
      },

      prefillAdvisedWeight: (exerciseName, weight) => {
        const key = normalizeExerciseName(exerciseName);
        let cambia = false;
        const exercises = get().exercises.map((ex) => {
          if (normalizeExerciseName(ex.name) !== key) return ex;
          // Un ejercicio por tiempo no lleva peso recomendado: su carga, si la
          // hay, es el lastre que escriba el usuario.
          if (ex.mode === 'time') return ex;
          // El indicador es de este ejercicio, no de la llamada: con uno solo
          // fuera del `map`, un segundo ejercicio con el mismo nombre (el mismo
          // movimiento repetido en el día) se recreaba sin cambios y el `set`
          // de abajo arrastraba un estado nuevo con las mismas series.
          let cambioAqui = false;
          const sets = ex.sets.map((s) => {
            if (s.weightTouched || s.weight === weight) return s;
            cambioAqui = true;
            return { ...s, weight };
          });
          if (!cambioAqui) return ex;
          cambia = true;
          return {
            ...ex,
            sets,
            ...(ex.savedAt ? { savedAt: undefined, clientId: undefined } : {}),
          };
        });
        // Sin cambios no se llama a `set`: esto lo dispara un efecto por
        // ejercicio y re-renderizar en bucle sería el resultado.
        if (cambia) set({ exercises });
      },

      setExerciseRpe: (exerciseIndex, rpe) => {
        const exercises = get().exercises.map((ex, i) =>
          i === exerciseIndex
            ? {
                ...ex,
                sets: ex.sets.map((s) => ({ ...s, rpe })),
                ...(ex.savedAt ? { savedAt: undefined, clientId: undefined } : {}),
              }
            : ex,
        );
        set({ exercises });
      },

      setExercises: (exercises) => set({ exercises }),

      discard: () => set({ ...emptySession }),

      finish: async (userId, resolveExerciseId, toKg) => {
        const { exercises, startedAt, finishedAt, saving } = get();
        if (saving) {
          return {
            error: null,
            success: false,
            savedExercises: 0,
            droppedSets: 0,
            savedExerciseNames: [],
          };
        }

        // Solo se registran los ejercicios que el usuario realmente ha hecho.
        // `clientId` es la clave de idempotencia de cada ejercicio: se fija una
        // sola vez, se persiste con la sesión y viaja igual en el intento directo
        // y en el outbox. Un reenvío —por un fallo duro o por cerrar la app a
        // mitad— manda la misma, así que el servidor no escribe dos veces los
        // ejercicios que ya había guardado antes de fallar.
        const withIds: (SessionExercise & { clientId: string })[] = exercises.map((ex) => ({
          ...ex,
          clientId: ex.clientId ?? crypto.randomUUID(),
        }));

        // Series a medias que se van a quedar fuera. Se cuentan antes de
        // filtrar para poder decirlo, en vez de perderlas sin ruido.
        const droppedSets = withIds.reduce(
          (n, ex) => n + ex.sets.filter((s) => pareceIntencionada(s) && !isValidSet(s)).length,
          0,
        );

        const alreadySaved = withIds.filter((ex) => ex.savedAt);
        const done = withIds
          .map((ex, index) => ({
            index,
            name: ex.name,
            sets: toOutboxSets(ex.sets, toKg),
            clientId: ex.clientId,
            saved: !!ex.savedAt,
          }))
          .filter((ex) => !ex.saved && ex.sets.length > 0);

        if (!done.length) {
          if (alreadySaved.length > 0) {
            // Todo lo que quedaba pendiente ya se escribió en un intento
            // anterior: la sesión ha terminado, no hay nada que reenviar.
            set({ ...emptySession });
            return {
              error: null,
              success: true,
              savedExercises: alreadySaved.length,
              droppedSets,
              savedExerciseNames: [],
            };
          }
          return {
            error: new Error('routine.errors.session_no_sets'),
            success: false,
            savedExercises: 0,
            droppedSets,
            savedExerciseNames: [],
          };
        }

        const started = startedAt ?? new Date().toISOString();
        // Congelada: forma parte de la huella del servidor. Regenerarla en cada
        // reintento convertía el mismo envío en «otro contenido» y lo dejaba
        // rechazado para siempre.
        const finished = finishedAt ?? new Date().toISOString();

        // Las claves y la hora de cierre se guardan antes de la primera llamada
        // de red: si el intento falla, el estado que queda para reintentar ya
        // las lleva.
        set({ exercises: withIds, saving: true, startedAt: started, finishedAt: finished });

        const notes =
          [get().routineName, get().dayName].filter(Boolean).join(' — ').trim() || undefined;

        // El esquema guarda un `workout` por ejercicio: la sesión de rutina se
        // escribe como N entrenos que comparten started_at/finished_at, de modo
        // que el historial (que agrupa por día) los muestre como una sesión.
        // Devuelve cuántos no se pudieron encolar: un fallo de IndexedDB aquí
        // (cuota, almacenamiento desalojado) antes reventaba `finish` con una
        // promesa rechazada en vez de contarlo en la pantalla.
        const enqueueRest = async (pending: typeof done): Promise<number> => {
          let failed = 0;
          for (const ex of pending) {
            try {
              await enqueueWorkout({
                id: ex.clientId,
                userId,
                exerciseId: resolveExerciseId(ex.name),
                customExerciseName: ex.name,
                customMuscleGroup: DEFAULT_MUSCLE_GROUP,
                startedAt: started,
                finishedAt: finished,
                sets: ex.sets,
                notes,
                createdAt: new Date().toISOString(),
              });
            } catch (err) {
              failed += 1;
              devError('[RoutineSession] no se pudo encolar:', {
                clientId: ex.clientId,
                exercise: ex.name,
                phase: 'outbox',
                error: err,
              });
            }
          }
          return failed;
        };

        const finishQueued = async (savedExercises: number, savedExerciseNames: string[]) => {
          set({ ...emptySession });
          void useOutboxStore.getState().refresh();
          return {
            error: null,
            success: true,
            queued: true,
            savedExercises,
            droppedSets,
            savedExerciseNames,
          };
        };

        // Marca el ejercicio como escrito para que el próximo intento lo salte
        // aunque el proceso muera justo después de esta respuesta.
        const markSaved = (index: number) => {
          set((state) => ({
            exercises: state.exercises.map((ex, i) =>
              i === index ? { ...ex, savedAt: new Date().toISOString() } : ex,
            ),
          }));
        };

        let saved = alreadySaved.length;
        const savedExerciseNames: string[] = [];

        for (const [i, ex] of done.entries()) {
          const outcome = await saveWorkoutOrQueue({
            clientId: ex.clientId,
            userId,
            exerciseId: resolveExerciseId(ex.name),
            customExerciseName: ex.name,
            customMuscleGroup: DEFAULT_MUSCLE_GROUP,
            startedAt: started,
            finishedAt: finished,
            sets: ex.sets,
            notes,
          });

          if (outcome.status === 'error') {
            // Clave ya usada con otro contenido. Con la hora de cierre
            // congelada y los ya guardados saltados, la única forma de llegar
            // aquí es que un intento anterior escribiera este ejercicio y el
            // proceso muriera antes de marcarlo: el entreno existe. Bloquear la
            // rutina para siempre por eso sería peor que darlo por bueno.
            const conflict =
              isIdempotencyConflict(outcome.error) ||
              isIdempotencyConflict((outcome.error as { cause?: unknown }).cause);
            if (conflict) {
              devError('[RoutineSession] conflicto de idempotencia: ya estaba guardado', {
                clientId: ex.clientId,
                exercise: ex.name,
                phase: 'rpc',
                code: 'idempotency_conflict',
              });
              markSaved(ex.index);
              saved += 1;
              savedExerciseNames.push(ex.name);
              continue;
            }

            set({ saving: false });
            devError('[RoutineSession] finish falló', {
              clientId: ex.clientId,
              exercise: ex.name,
              phase: 'rpc',
              code: (outcome.error as { code?: string }).code ?? null,
              message: outcome.error.message,
              sets: ex.sets.length,
            });
            return {
              error: outcome.error,
              success: false,
              savedExercises: saved,
              droppedSets,
              savedExerciseNames,
            };
          }

          if (outcome.status === 'queued') {
            // Este ya está en la cola; faltan los que ni se han intentado. El
            // corte va en `i + 1` justamente por eso: encolar desde `i` lo
            // metería dos veces.
            const rest = done.slice(i + 1);
            const failed = await enqueueRest(rest);
            if (failed > 0) {
              // La sesión sigue en el store con sus `clientId`: reintentar la
              // reencola con los mismos ids y el servidor dedupe por ellos.
              set({ saving: false });
              return {
                error: new Error('workout.errors.queue_failed'),
                success: false,
                savedExercises: saved,
                droppedSets,
                savedExerciseNames,
              };
            }
            return finishQueued(saved + 1 + rest.length, [
              ...savedExerciseNames,
              ex.name,
              ...rest.map((r) => r.name),
            ]);
          }

          saved += 1;
          savedExerciseNames.push(ex.name);
          markSaved(ex.index);
        }

        set({ ...emptySession });
        return {
          error: null,
          success: true,
          savedExercises: saved,
          droppedSets,
          savedExerciseNames,
        };
      },
    }),
    {
      name: 'gymlog-routine-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        routineId: s.routineId,
        routineName: s.routineName,
        dayName: s.dayName,
        day: s.day,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        exercises: s.exercises,
      }),
    },
  ),
);
