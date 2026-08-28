/**
 * Importar historial exportado desde otra app de entrenamiento.
 *
 * Todas exportan lo mismo en dialectos distintos: una fila por **serie**, con
 * una fecha, un nombre de ejercicio y alguna mezcla de peso / repeticiones /
 * distancia / tiempo. Por eso aquí las columnas se localizan **por su cabecera**
 * y no por su posición: así soportar una app nueva suele ser añadir un alias, no
 * escribir otro importador.
 *
 * El importador que ya existía (`useHistoryTransfer.importFromCsv`) adivina las
 * columnas por posición y se salta las series con peso 0 —o sea, todo el trabajo
 * a peso corporal—. Sirve para los CSV propios y se queda; esto es la vía para
 * los ficheros de fuera.
 *
 * **La salida es el mismo JSON que ya consume `parseImportedWorkouts`**, a
 * propósito: así los ficheros de terceros heredan gratis la validación con Zod,
 * el diálogo de confirmación, el conteo de duplicados y el guardado por RPC. No
 * hay una segunda tubería que mantener.
 */

import { parseImportDate } from './exportImport';

/** Apps reconocidas. `generic` es el encaje flexible por cabeceras sueltas. */
export type TrackerId = 'strong' | 'hevy' | 'fitnotes' | 'generic';

export const TRACKER_NAME: Record<TrackerId, string> = {
  strong: 'Strong',
  hevy: 'Hevy',
  fitnotes: 'FitNotes',
  generic: 'CSV genérico',
};

/** Una libra en kilos. GymLog guarda siempre kg. */
const LB_TO_KG = 0.45359237;

/**
 * Marca de orden de bytes que algunos exportadores ponen al principio del
 * fichero. Si se cuela, la primera cabecera lleva el BOM pegado y no casa con
 * ningun alias: el importador diria que no reconoce un fichero perfectamente
 * valido.
 */
const BOM = '\uFEFF';

/** Topes de cordura, alineados con los de `importSchema`. */
const MAX_REPS = 1000;
const MAX_WEIGHT_KG = 2000;

/* ----------------------------------------------------------------- CSV ---- */

/**
 * Lector de CSV de verdad: campos entrecomillados, comas y saltos de línea
 * dentro del campo, comillas dobladas (`""`), BOM y CRLF.
 *
 * Partir por comas se rompe con el primer ejercicio que se llame
 * `"Press banca, agarre cerrado"`, y lo peor es que no falla: importa el
 * historial entero desplazado una columna sin dar un solo error.
 */
export function parseCsv(text: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entrecomillado = false;

  // Fuera el BOM: si se cuela, la primera cabecera nunca casa con su alias.
  const bruto = String(text ?? '');
  const s = bruto.startsWith(BOM) ? bruto.slice(BOM.length) : bruto;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (entrecomillado) {
      if (c === '"') {
        // Comilla doblada dentro de un campo entrecomillado: es una comilla.
        if (s[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entrecomillado = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      entrecomillado = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      fila.push(campo);
      campo = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else {
      campo += c;
    }
  }

  fila.push(campo);
  if (fila.some((x) => x !== '')) filas.push(fila);
  return filas;
}

/* ------------------------------------------------------------ columnas ---- */

/** Campos que sabemos leer de una fila, sea cual sea la app de origen. */
type Campo =
  | 'exercise'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'workoutName'
  | 'weight'
  | 'weightKg'
  | 'weightLb'
  | 'weightUnit'
  | 'reps'
  | 'setType'
  | 'rpe'
  | 'notes';

type ColumnMap = Partial<Record<Campo, number>>;

/** Cabecera → forma canónica: minúsculas, sin signos, espacios colapsados. */
const normalizarCabecera = (h: string): string =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Alias de cabecera por campo. **El orden importa**: gana la primera que case,
 * así que lo específico va antes que lo genérico — `weight kg` tiene que
 * resolverse antes que `weight`, o un export en libras acabaría guardado como
 * si fueran kilos.
 */
const ALIAS: [Campo, string[]][] = [
  ['exercise', ['exercise name', 'exercise title', 'exercise', 'ejercicio']],
  ['startTime', ['start time', 'start_time']],
  ['endTime', ['end time', 'end_time']],
  ['date', ['date', 'workout date', 'fecha']],
  ['workoutName', ['workout name', 'title', 'entrenamiento']],
  ['weightKg', ['weight kg', 'weight_kg']],
  ['weightLb', ['weight lbs', 'weight lb', 'weight_lbs']],
  ['weightUnit', ['weight unit', 'unit', 'unidad']],
  ['weight', ['weight', 'peso']],
  ['reps', ['reps', 'repetitions', 'repeticiones']],
  ['setType', ['set type', 'set_type', 'kind']],
  ['rpe', ['rpe']],
  ['notes', ['notes', 'note', 'comment', 'exercise notes', 'notas']],
];

/** Localiza cada campo conocido en la fila de cabeceras. */
function mapearColumnas(cabeceras: string[]): ColumnMap {
  const normalizadas = cabeceras.map(normalizarCabecera);
  const mapa: ColumnMap = {};

  for (const [campo, alias] of ALIAS) {
    for (const a of alias) {
      const idx = normalizadas.indexOf(a);
      // Una columna solo puede alimentar un campo: sin esto, `weight kg` se
      // asignaría también a `weight` y el desempate de unidades daría igual.
      if (idx !== -1 && !Object.values(mapa).includes(idx)) {
        mapa[campo] = idx;
        break;
      }
    }
  }
  return mapa;
}

/**
 * Deduce de qué app viene el fichero por las columnas que solo ella tiene.
 *
 * Es solo para poder decírselo al usuario («detectado: Hevy»); la lectura no
 * depende de acertar, porque va por cabeceras. Si no se reconoce ninguna se
 * intenta igual como `generic`.
 */
function detectarApp(cabeceras: string[]): TrackerId {
  const set = new Set(cabeceras.map(normalizarCabecera));
  if (set.has('weight kg') && set.has('set index')) return 'hevy';
  if (set.has('set order') && set.has('workout name')) return 'strong';
  if (set.has('category') && (set.has('weight unit') || set.has('weight kg'))) return 'fitnotes';
  return 'generic';
}

/* -------------------------------------------------------------- lectura --- */

/** Lee un número de una celda, tolerando coma decimal y espacios. */
function num(valor: string | undefined): number | null {
  if (valor == null) return null;
  const limpio = valor.replace(/\s+/g, '').replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * Peso de la fila, siempre en kg.
 *
 * Se mira en este orden: la columna que ya dice la unidad en su nombre
 * (`weight_kg` / `weight (lbs)`), y si no, la columna genérica desempatada por
 * la columna de unidad. FitNotes en iOS trae **las dos** columnas y rellena solo
 * la que corresponde, así que una vacía no significa cero: significa «esta no».
 */
function pesoEnKg(fila: string[], mapa: ColumnMap): number {
  const kg = mapa.weightKg != null ? num(fila[mapa.weightKg]) : null;
  if (kg != null) return kg;

  const lb = mapa.weightLb != null ? num(fila[mapa.weightLb]) : null;
  if (lb != null) return lb * LB_TO_KG;

  const bruto = mapa.weight != null ? num(fila[mapa.weight]) : null;
  if (bruto == null) return 0;

  const unidad = mapa.weightUnit != null ? (fila[mapa.weightUnit] ?? '').toLowerCase() : '';
  return unidad.includes('lb') ? bruto * LB_TO_KG : bruto;
}

/** Fecha `YYYY-MM-DD` de la fila, mirando primero la marca de tiempo. */
function fechaDe(fila: string[], mapa: ColumnMap): string | null {
  const candidatas = [mapa.startTime, mapa.date]
    .filter((i): i is number => i != null)
    .map((i) => (fila[i] ?? '').trim())
    .filter((v) => v !== '');

  for (const v of candidatas) {
    // Formatos con hora: «2026-08-25 18:30:00», ISO, «25 Aug 2026, 18:30».
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }

    // Último recurso: los formatos dd/mm/yyyy que ya sabe leer la app.
    const propia = parseImportDate(v);
    if (propia) return propia;
  }
  return null;
}

/** Marca de tiempo ISO completa si la fila la trae; si no, mediodía de la fecha. */
function instanteDe(fila: string[], mapa: ColumnMap, fecha: string): string {
  const bruto = mapa.startTime != null ? (fila[mapa.startTime] ?? '').trim() : '';
  if (bruto) {
    const d = new Date(bruto);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  // Mediodía y no medianoche: una fecha sin hora a las 00:00 se desplaza al día
  // anterior en cuanto el dispositivo está en un huso al oeste de UTC.
  return `${fecha}T12:00:00.000Z`;
}

/** Tipos de serie que Hevy marca como calentamiento. */
const TIPOS_CALENTAMIENTO = ['warmup', 'warm up', 'calentamiento'];

/* --------------------------------------------------------------- salida --- */

/** Serie en el formato crudo que espera `parseImportedWorkouts`. */
interface SerieCruda {
  exercise: string;
  reps: number;
  weight: number;
  set_num: number;
  is_warmup: boolean;
  notes: string;
  rpe: string;
}

/** Entreno en el formato crudo que espera `parseImportedWorkouts`. */
export interface EntrenoCrudo {
  started_at: string;
  finished_at: string;
  sets: SerieCruda[];
}

export interface TrackerParseResult {
  /** App detectada, para poder decírselo al usuario. */
  tracker: TrackerId;
  /** Entrenos listos para la tubería de importación que ya existe. */
  workouts: EntrenoCrudo[];
  /** Series leídas correctamente. */
  sets: number;
  /**
   * Filas descartadas por no tener repeticiones: en la práctica son las de
   * cardio (distancia/tiempo), que este importador todavía no cubre. Se cuentan
   * para poder decirlo en vez de perderlas en silencio.
   */
  skippedRows: number;
  /** Nombres de ejercicio distintos vistos en el fichero. */
  exerciseNames: string[];
}

/** El fichero no tenía forma de export de entrenamiento. */
export class TrackerFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrackerFormatError';
  }
}

/**
 * Convierte el CSV de otra app en entrenos agrupados por día.
 *
 * Se agrupa por fecha y no por marca de tiempo exacta a propósito: FitNotes no
 * exporta hora, así que agrupar por instante partiría un entreno en tantos
 * «entrenos» como series tiene.
 *
 * Lanza `TrackerFormatError` si no hay cabecera reconocible; las filas sueltas
 * que no valen se cuentan en `skippedRows` y no interrumpen la lectura.
 */
export function parseTrackerCsv(text: string): TrackerParseResult {
  const filas = parseCsv(text);
  if (filas.length < 2) {
    throw new TrackerFormatError('El fichero no tiene cabecera y al menos una fila de datos.');
  }

  const cabeceras = filas[0];
  const mapa = mapearColumnas(cabeceras);

  // Sin nombre de ejercicio no hay nada que importar, y sin fecha no se puede
  // colocar en el historial. Es el mínimo para no tragarse un fichero ajeno.
  if (mapa.exercise == null || (mapa.date == null && mapa.startTime == null)) {
    throw new TrackerFormatError('No se reconocen las columnas de ejercicio y fecha.');
  }

  const tracker = detectarApp(cabeceras);

  /** Entrenos por fecha, conservando el orden de aparición del fichero. */
  const porFecha = new Map<string, { instante: string; sets: SerieCruda[] }>();
  /** Contador de serie por (fecha, ejercicio) para cuando el fichero no lo trae. */
  const contadorSeries = new Map<string, number>();
  const nombres = new Set<string>();
  let skippedRows = 0;
  let sets = 0;

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];

    const ejercicio = (fila[mapa.exercise] ?? '').trim();
    if (!ejercicio) {
      skippedRows++;
      continue;
    }

    const fecha = fechaDe(fila, mapa);
    if (!fecha) {
      skippedRows++;
      continue;
    }

    const reps = mapa.reps != null ? num(fila[mapa.reps]) : null;
    // Sin repeticiones no es una serie de fuerza. Son las filas de cardio, que
    // se cuentan aparte en vez de entrar con un 0 que ensuciaría las medias.
    if (reps == null || reps <= 0 || reps > MAX_REPS) {
      skippedRows++;
      continue;
    }

    const peso = pesoEnKg(fila, mapa);
    if (peso < 0 || peso > MAX_WEIGHT_KG) {
      skippedRows++;
      continue;
    }

    // Un peso de 0 es un dato válido —dominadas, fondos, abdominales—, no una
    // fila rota. El importador antiguo las descartaba y con ellas todo el
    // trabajo a peso corporal del historial.
    const tipo = mapa.setType != null ? (fila[mapa.setType] ?? '').toLowerCase() : '';
    const esCalentamiento = TIPOS_CALENTAMIENTO.some((v) => tipo.includes(v));

    // El número de serie se cuenta aquí y no se lee del fichero a propósito:
    // Strong numera desde 1 y Hevy desde 0, así que tomar la columna tal cual
    // haría colisionar la serie 1 de un fichero con la 1 de otro dentro del
    // mismo dedupe. Las filas de un export siempre vienen en orden, así que
    // contar por (fecha, ejercicio) da el mismo número sin depender del origen.
    const clave = `${fecha}|${ejercicio.toLowerCase()}`;
    const setNum = (contadorSeries.get(clave) ?? 0) + 1;
    contadorSeries.set(clave, setNum);

    const rpeBruto = mapa.rpe != null ? num(fila[mapa.rpe]) : null;

    const entrada = porFecha.get(fecha) ?? { instante: instanteDe(fila, mapa, fecha), sets: [] };
    entrada.sets.push({
      exercise: ejercicio,
      reps: Math.floor(reps),
      weight: Math.round(peso * 100) / 100,
      set_num: setNum,
      is_warmup: esCalentamiento,
      notes: mapa.notes != null ? (fila[mapa.notes] ?? '').trim() : '',
      rpe: rpeBruto != null ? String(rpeBruto) : '',
    });
    porFecha.set(fecha, entrada);

    nombres.add(ejercicio);
    sets++;
  }

  const workouts: EntrenoCrudo[] = [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { instante, sets: filasDia }]) => ({
      started_at: instante,
      finished_at: instante,
      sets: filasDia,
    }));

  return {
    tracker,
    workouts,
    sets,
    skippedRows,
    exerciseNames: [...nombres].sort((a, b) => a.localeCompare(b)),
  };
}
