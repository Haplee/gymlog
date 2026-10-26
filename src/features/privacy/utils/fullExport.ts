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

export type ExportTable = (typeof EXPORT_TABLE_ORDER)[number];

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
