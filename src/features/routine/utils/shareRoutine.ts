/**
 * Compartir una rutina: como fichero para que otra persona la importe, o
 * impresa en papel/PDF para llevarla al gimnasio.
 *
 * **Solo viaja el plan.** Nombre de la rutina, días y ejercicios con sus series
 * y repeticiones. Ni entrenamientos, ni pesos levantados, ni pesajes, ni notas
 * personales: mandarle la rutina a un amigo no puede ser mandarle de paso lo que
 * levantas y lo que pesas. Es la razón de que esto construya su propio objeto en
 * vez de serializar el `Routine` del store, que lleva más cosas dentro.
 *
 * Al importar se **fusiona**: la rutina entra como una más. Nunca se sobrescribe
 * lo que el usuario ya tiene — recibir un fichero no puede borrarte el plan.
 */

import { DAY_ORDER, type DayOfWeek, type Routine } from '@features/routine/stores/routineStore';
import { MAX_DURACION_SEGUNDOS, MIN_DURACION_SEGUNDOS } from './planTarget';

/**
 * Versión del formato del fichero.
 *
 * Va dentro para que un GymLog viejo sepa reconocer un fichero nuevo y avisar,
 * en vez de leerlo a medias y crear una rutina incompleta.
 */
export const SHARE_FORMAT_VERSION = 2;

/**
 * Versiones que este GymLog sabe leer.
 *
 * La v1 no llevaba modo de registro, y no lleva nada que haya que traducir: un
 * ejercicio sin `mode` **es** un ejercicio de repeticiones, que es justo lo que
 * significaba antes. Por eso la compatibilidad hacia atrás no necesita ninguna
 * conversión, solo no exigir los campos nuevos.
 */
export const SHARE_MIN_READABLE_VERSION = 1;

/** Marca del fichero: identifica que esto es un plan de GymLog y no otra cosa. */
export const SHARE_KIND = 'gymlog.routine';

export interface SharedExercise {
  name: string;
  sets?: number;
  reps?: string;
  notes?: string;
  /** Ausente = repeticiones. Ver `planTarget`. */
  mode?: 'reps' | 'time';
  perSide?: boolean;
  durationSeconds?: number;
  /** Grupo de superserie. Ver `RoutineExercise.supersetId`. */
  supersetId?: string;
}

export interface SharedDay {
  day: DayOfWeek;
  name: string;
  exercises: SharedExercise[];
}

export interface SharedRoutine {
  kind: typeof SHARE_KIND;
  version: number;
  name: string;
  description: string;
  /** Solo los días con trabajo: un fichero con cuatro días vacíos es ruido. */
  days: SharedDay[];
  /** Cuándo se generó, en ISO. Informativo. */
  exportedAt: string;
}

/** Etiquetas de los días para lo que se imprime. */
export const DAY_LABEL: Record<DayOfWeek, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const tieneTrabajo = (dia: { exercises?: unknown[] } | undefined): boolean =>
  Array.isArray(dia?.exercises) && dia.exercises.length > 0;

/** Convierte una rutina del store en el objeto que se comparte. */
export function buildSharedRoutine(routine: Routine, now: Date = new Date()): SharedRoutine {
  const days: SharedDay[] = [];

  for (const day of DAY_ORDER) {
    const dayRoutine = routine.days[day];
    if (!tieneTrabajo(dayRoutine)) continue;
    days.push({
      day,
      name: dayRoutine.name,
      exercises: dayRoutine.exercises.map((ex) => ({
        name: ex.name,
        // Los opcionales solo se escriben si tienen valor: un fichero lleno de
        // `undefined` es más difícil de leer para quien lo abra a mano.
        ...(ex.sets != null ? { sets: ex.sets } : {}),
        ...(ex.reps ? { reps: ex.reps } : {}),
        ...(ex.notes ? { notes: ex.notes } : {}),
        // El modo por defecto no se escribe: un fichero de una rutina de
        // repeticiones sale byte a byte como salía antes, y quien lo abra a
        // mano no se encuentra `"mode": "reps"` repetido en cada línea.
        ...(ex.mode === 'time' ? { mode: 'time' as const } : {}),
        ...(ex.perSide ? { perSide: true } : {}),
        ...(ex.mode === 'time' && ex.durationSeconds != null
          ? { durationSeconds: ex.durationSeconds }
          : {}),
        ...(ex.supersetId ? { supersetId: ex.supersetId } : {}),
      })),
    });
  }

  return {
    kind: SHARE_KIND,
    version: SHARE_FORMAT_VERSION,
    name: routine.name,
    description: routine.description,
    days,
    exportedAt: now.toISOString(),
  };
}

/** El JSON que se guarda o se comparte, ya con sangría para poder leerlo. */
export function serializeSharedRoutine(routine: Routine, now?: Date): string {
  return JSON.stringify(buildSharedRoutine(routine, now), null, 2);
}

/** Nombre de fichero a partir del de la rutina, sin caracteres problemáticos. */
export function sharedRoutineFileName(routine: Routine): string {
  const base = routine.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `rutina-${base || 'gymlog'}.json`;
}

/* ------------------------------------------------------------ importar ---- */

export class SharedRoutineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SharedRoutineError';
  }
}

/** Tope de cordura para no tragarse un fichero fabricado a mala idea. */
const MAX_DIAS = 7;
const MAX_EJERCICIOS_POR_DIA = 100;
const MAX_LARGO_TEXTO = 200;

const texto = (v: unknown, porDefecto = ''): string =>
  typeof v === 'string' ? v.trim().slice(0, MAX_LARGO_TEXTO) : porDefecto;

/** Segundos de una serie por tiempo, o `null` si el número no sirve. */
const duracion = (v: unknown): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.floor(v);
  return n >= MIN_DURACION_SEGUNDOS && n <= MAX_DURACION_SEGUNDOS ? n : null;
};

/**
 * Lee un fichero de rutina compartida y lo deja listo para añadir.
 *
 * Es una frontera con el exterior —un fichero que llega por WhatsApp— así que
 * todo se valida y se recorta: nada de confiar en que los campos vengan como
 * deben. Lo que no encaje se descarta; lo que falte por completo lanza.
 */
export function parseSharedRoutine(raw: unknown): SharedRoutine {
  if (typeof raw !== 'object' || raw === null) {
    throw new SharedRoutineError('El fichero no contiene una rutina.');
  }
  const obj = raw as Record<string, unknown>;

  if (obj.kind !== SHARE_KIND) {
    throw new SharedRoutineError('El fichero no es una rutina de GymLog.');
  }
  if (typeof obj.version !== 'number' || obj.version > SHARE_FORMAT_VERSION) {
    throw new SharedRoutineError('El fichero viene de una versión más nueva de GymLog.');
  }
  if (obj.version < SHARE_MIN_READABLE_VERSION) {
    throw new SharedRoutineError('El fichero viene de una versión de GymLog demasiado antigua.');
  }

  const nombre = texto(obj.name);
  if (!nombre) throw new SharedRoutineError('La rutina no tiene nombre.');

  const diasValidos = new Set<string>(DAY_ORDER);
  const days: SharedDay[] = [];

  for (const bruto of Array.isArray(obj.days) ? obj.days.slice(0, MAX_DIAS) : []) {
    if (typeof bruto !== 'object' || bruto === null) continue;
    const d = bruto as Record<string, unknown>;
    if (typeof d.day !== 'string' || !diasValidos.has(d.day)) continue;

    const exercises: SharedExercise[] = [];
    for (const be of Array.isArray(d.exercises)
      ? d.exercises.slice(0, MAX_EJERCICIOS_POR_DIA)
      : []) {
      if (typeof be !== 'object' || be === null) continue;
      const e = be as Record<string, unknown>;
      const name = texto(e.name);
      if (!name) continue;
      exercises.push({
        name,
        ...(typeof e.sets === 'number' && e.sets > 0 && e.sets <= 50
          ? { sets: Math.floor(e.sets) }
          : {}),
        ...(texto(e.reps) ? { reps: texto(e.reps) } : {}),
        ...(texto(e.notes) ? { notes: texto(e.notes) } : {}),
        // Solo se acepta 'time'. Cualquier otra cosa —'cardio', un número, un
        // objeto— se ignora y el ejercicio queda de repeticiones, que es el
        // comportamiento de siempre y el único que todas las pantallas saben
        // pintar.
        ...(e.mode === 'time' ? { mode: 'time' as const } : {}),
        ...(e.perSide === true ? { perSide: true } : {}),
        ...(e.mode === 'time' && duracion(e.durationSeconds) != null
          ? { durationSeconds: duracion(e.durationSeconds) as number }
          : {}),
        // El id que llega se recorta pero no se regenera: lo que importa es que
        // dos ejercicios del fichero compartan el mismo, y renombrarlo aquí
        // rompería justo eso.
        ...(texto(e.supersetId) ? { supersetId: texto(e.supersetId) } : {}),
      });
    }

    if (exercises.length === 0) continue;
    days.push({ day: d.day as DayOfWeek, name: texto(d.name, 'Entrenamiento'), exercises });
  }

  if (days.length === 0) {
    throw new SharedRoutineError('La rutina no tiene ningún día con ejercicios.');
  }

  return {
    kind: SHARE_KIND,
    version: SHARE_FORMAT_VERSION,
    name: nombre,
    description: texto(obj.description),
    days,
    exportedAt: texto(obj.exportedAt),
  };
}

/**
 * Convierte una rutina recibida en una del store, lista para `addRoutine`.
 *
 * `id` nuevo siempre: si se reutilizara el del fichero, importar dos veces la
 * misma rutina —o recibir la de alguien cuyo id coincide— machacaría la que ya
 * hay. Fusionar significa exactamente esto.
 */
export function sharedRoutineToStore(
  shared: SharedRoutine,
  makeId: () => string = () => crypto.randomUUID(),
  now: Date = new Date(),
): Routine {
  // Se construye a mano y no con Object.fromEntries: este necesita un `as` que
  // le quita a TypeScript la única garantía que importa aquí — que estén los
  // siete días. Un día que faltase reventaría al pintar la semana.
  const days = {} as Routine['days'];
  for (const d of DAY_ORDER) days[d] = { name: '', exercises: [] };

  for (const d of shared.days) {
    days[d.day] = {
      name: d.name,
      exercises: d.exercises.map((e) => ({
        name: e.name,
        ...(e.sets != null ? { sets: e.sets } : {}),
        ...(e.reps ? { reps: e.reps } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
        ...(e.mode === 'time' ? { mode: 'time' as const } : {}),
        ...(e.perSide ? { perSide: true } : {}),
        ...(e.durationSeconds != null ? { durationSeconds: e.durationSeconds } : {}),
        ...(e.supersetId ? { supersetId: e.supersetId } : {}),
      })),
    };
  }

  return {
    id: makeId(),
    name: shared.name,
    description: shared.description,
    days,
    isCustom: true,
    createdAt: now.toISOString(),
  };
}
