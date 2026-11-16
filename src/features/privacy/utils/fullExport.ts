/**
 * Construcción del paquete de exportación completo de la cuenta.
 *
 * Es una función pura a propósito: recibe las filas ya leídas y devuelve el
 * JSON. Así se puede probar sin red ni Supabase, y el orden de las claves —que
 * es lo que hace el fichero legible— queda fijado aquí y no depende de en qué
 * orden hayan llegado las respuestas.
 *
 * Qué incluye: todo lo que el usuario puede ver en la app, más el perfil y el
 * estado del entrenador. Qué no incluye: el token push en claro. No es un
 * olvido. El token es una credencial del dispositivo: sirve para enviarle
 * notificaciones y no aporta nada al derecho de acceso. Se exporta la fila con
 * su plataforma y fechas, con `token` marcado como redactado.
 */

export const ACCOUNT_EXPORT_SCHEMA = 'gymlog.account-export';
export const ACCOUNT_EXPORT_VERSION = 1;

export interface ExportUser {
  id: string;
  email: string | null;
  createdAt?: string | null;
  lastSignInAt?: string | null;
  provider?: string | null;
}

export interface AccountSnapshot {
  /** Filas por tabla, tal y como las devuelve la base de datos. */
  tables: Record<string, unknown[]>;
  /** Tablas que no se pudieron leer, con el motivo. */
  errors?: Record<string, string>;
  avatarUrl?: string | null;
}

export interface AccountExportInput {
  exportedAt: string;
  user: ExportUser;
  snapshot: AccountSnapshot;
}

/** Orden de secciones en el fichero. Cambiarlo cambia el formato público. */
export const EXPORT_TABLE_ORDER = [
  'profiles',
  'body_measurements',
  'workouts',
  'workout_sets',
  'personal_records',
  'exercises',
  'exercise_muscles',
  'exercise_favorites',
  'exercise_goals',
  'exercise_notes',
  'exercise_progression',
  'progression_log',
  'user_routines',
  'cardio_sessions',
  'health_sessions',
  'lift_analyses',
  'wearable_connections',
  'wearable_daily',
  'wearable_sleep',
  'push_tokens',
  'ai_coach_memory',
  'ai_coach_messages',
  'ai_coach_suggestions',
  'ai_coach_usage',
  'ai_coach_audit',
] as const;

/**
 * Quita el token del dispositivo de las filas de `push_tokens`.
 *
 * Se conserva el resto de la fila (plataforma, fechas) porque sí describe el
 * tratamiento: cuándo se registró el dispositivo y para qué plataforma.
 */
export function redactPushTokens(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    // Copia y borrado explícito en vez de desestructurar: el token no debe
    // sobrevivir ni como variable intermedia.
    const copy = { ...(row as Record<string, unknown>) };
    delete copy.token;
    return { ...copy, token: null, token_redacted: true };
  });
}

/** Aplica las redacciones conocidas a una tabla. */
export function redactTable(table: string, rows: unknown[]): unknown[] {
  return table === 'push_tokens' ? redactPushTokens(rows) : rows;
}

/** Cuenta las filas de cada sección, sin contar las que no existen. */
export function countRows(tables: Record<string, unknown[]>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of EXPORT_TABLE_ORDER) {
    const rows = tables[table];
    if (Array.isArray(rows)) counts[table] = rows.length;
  }
  return counts;
}

/**
 * Serializa la exportación.
 *
 * `JSON.stringify(..., null, 2)` y no una línea: el fichero se entrega a una
 * persona, no a un programa. El orden de las secciones lo impone
 * `EXPORT_TABLE_ORDER`, no el objeto de entrada.
 */
export function buildAccountExport(input: AccountExportInput): string {
  const data: Record<string, unknown> = {};
  for (const table of EXPORT_TABLE_ORDER) {
    const rows = input.snapshot.tables[table];
    if (!Array.isArray(rows)) continue;
    data[table] = redactTable(table, rows);
  }

  const payload = {
    schema: ACCOUNT_EXPORT_SCHEMA,
    version: ACCOUNT_EXPORT_VERSION,
    exportedAt: input.exportedAt,
    user: {
      id: input.user.id,
      email: input.user.email,
      createdAt: input.user.createdAt ?? null,
      lastSignInAt: input.user.lastSignInAt ?? null,
      provider: input.user.provider ?? null,
      avatarUrl: input.snapshot.avatarUrl ?? null,
    },
    counts: countRows(input.snapshot.tables),
    errors: input.snapshot.errors ?? {},
    notes: [
      'Los tokens push se incluyen sin su valor: son credenciales del dispositivo y no forman parte de la información del usuario.',
      'Las contraseñas nunca se incluyen: la app no las almacena en claro.',
    ],
    data,
  };

  return JSON.stringify(payload, null, 2);
}

/** Nombre estable del fichero, con la fecha del día. */
export function exportFileName(date: Date): string {
  return `gymlog-datos-${date.toISOString().slice(0, 10)}.json`;
}

// ---------------------------------------------------------------------------
// CSV del historial
// ---------------------------------------------------------------------------

/**
 * Escapa un campo según RFC 4180.
 *
 * Se entrecomilla también cuando hay `;`: Excel en español interpreta la coma
 * como separador de columnas y el punto y coma como decimal, así que un texto
 * con `;` sin comillas se parte en dos celdas al abrirlo.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (!/[",;\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function textOf(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : String(value);
}

function numberOf(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Cabecera del CSV. Cambiarla cambia el formato entregado al usuario. */
export const WORKOUT_CSV_HEADER = [
  'Inicio (ISO)',
  'Entrenamiento',
  'Ejercicio',
  'Serie',
  'Peso (kg)',
  'Reps',
  'RIR',
  'RPE',
  'Tipo',
  'Calentamiento',
  'Volumen (kg)',
  'Notas de la serie',
  'Notas del entreno',
] as const;

/**
 * Historial de entrenos en CSV, una fila por serie.
 *
 * El JSON es completo pero no se abre en una hoja de cálculo. Este fichero sí:
 * es la forma en la que alguien comprueba su progreso fuera de la app o lo
 * lleva a su entrenador.
 *
 * - Los entrenos sin series **no se pierden**: salen como una fila con las
 *   columnas de la serie vacías.
 * - Las series se ordenan por `set_num` dentro de cada entreno, y los entrenos
 *   por fecha de inicio. El orden de la consulta no decide el del fichero.
 * - `exerciseNames` viene aparte porque la exportación completa solo incluye
 *   los ejercicios propios: el catálogo público no es dato del usuario, pero
 *   su nombre sí hace falta para leer el CSV.
 */
export function buildWorkoutCsv(
  snapshot: AccountSnapshot,
  exerciseNames: Record<string, string> = {},
): string {
  const rows = snapshot.tables;
  const workouts = (Array.isArray(rows.workouts) ? rows.workouts : []) as Record<string, unknown>[];
  const sets = (Array.isArray(rows.workout_sets) ? rows.workout_sets : []) as Record<
    string,
    unknown
  >[];

  // Los nombres propios del snapshot completan el mapa por si el llamador no
  // pasó el catálogo (tests, exportaciones parciales).
  const names: Record<string, string> = { ...exerciseNames };
  for (const exercise of (rows.exercises ?? []) as Record<string, unknown>[]) {
    const id = textOf(exercise, 'id');
    const name = textOf(exercise, 'name');
    if (id && name && !names[id]) names[id] = name;
  }

  const setsByWorkout = new Map<string, Record<string, unknown>[]>();
  for (const set of sets) {
    const workoutId = textOf(set, 'workout_id');
    const list = setsByWorkout.get(workoutId) ?? [];
    list.push(set);
    setsByWorkout.set(workoutId, list);
  }

  const orderedWorkouts = [...workouts].sort((a, b) =>
    textOf(a, 'started_at').localeCompare(textOf(b, 'started_at')),
  );

  const lines: string[] = [WORKOUT_CSV_HEADER.map((cell) => csvField(cell)).join(',')];

  for (const workout of orderedWorkouts) {
    const workoutId = textOf(workout, 'id');
    const workoutSets = (setsByWorkout.get(workoutId) ?? []).sort(
      (a, b) => (numberOf(a, 'set_num') ?? 0) - (numberOf(b, 'set_num') ?? 0),
    );
    const base = [textOf(workout, 'started_at'), textOf(workout, 'name')];

    if (workoutSets.length === 0) {
      lines.push(
        [
          ...base,
          '', // ejercicio
          '', // serie
          '', // peso
          '', // reps
          '', // rir
          '', // rpe
          '', // tipo
          '', // calentamiento
          '', // volumen
          '', // notas de la serie
          textOf(workout, 'notes'),
        ]
          .map(csvField)
          .join(','),
      );
      continue;
    }

    for (const set of workoutSets) {
      const weight = numberOf(set, 'weight');
      const reps = numberOf(set, 'reps');
      const volume =
        weight !== null && reps !== null ? Math.round(weight * reps * 100) / 100 : null;
      lines.push(
        [
          ...base,
          names[textOf(set, 'exercise_id')] ?? '',
          numberOf(set, 'set_num') ?? '',
          weight ?? '',
          reps ?? '',
          numberOf(set, 'rir') ?? '',
          numberOf(set, 'rpe') ?? '',
          textOf(set, 'set_type'),
          set.is_warmup === true ? 'sí' : 'no',
          volume ?? '',
          textOf(set, 'notes'),
          textOf(workout, 'notes'),
        ]
          .map(csvField)
          .join(','),
      );
    }
  }

  // BOM: sin él, Excel en Windows abre el fichero en ANSI y destroza tildes y
  // eñes («Press de banca» → «Press de banca» con caracteres raros).
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Nombre estable del CSV, con la fecha del día. */
export function workoutCsvFileName(date: Date): string {
  return `gymlog-entrenos-${date.toISOString().slice(0, 10)}.csv`;
}
