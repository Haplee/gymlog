// Helpers PUROS de import/export del historial. Sin IO (sin Capacitor, supabase
// ni FileReader) para que sean testables y reutilizables. La orquestación async
// (crear workouts, escribir/compartir ficheros) vive en la página.

/** Tokeniza una línea CSV respetando comillas dobles. Devuelve celdas trim(). */
export function tokenizeCsvLine(line: string): string[] {
  const cols: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cols.push(current.trim());
  return cols;
}

/** Saca un número de una celda sucia. Rango válido (0, 2000), 1 decimal. */
export function parseImportNumber(val: string | undefined): number | null {
  if (!val) return null;
  let cleaned = val.replace(/["']/g, '').trim().toLowerCase();
  if (cleaned === '' || cleaned === '-' || cleaned === 'no' || cleaned === 'n/a') return null;
  cleaned = cleaned
    .replace(/[a-z]/g, ' ')
    .replace(/[^\d,.-]/g, ' ')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0 && num < 2000 ? Math.round(num * 10) / 10 : null;
}

/** Normaliza una fecha a YYYY-MM-DD desde varios formatos. null si no parsea. */
export function parseImportDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const cleaned = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const formats = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, day: 1, month: 2, year: 3 },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, day: 1, month: 2, year: 3 },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, day: 1, month: 2, year: 3 },
  ];
  for (const fmt of formats) {
    const match = cleaned.match(fmt.regex);
    if (match) {
      let year = parseInt(match[fmt.year], 10);
      const month = parseInt(match[fmt.month], 10);
      const day = parseInt(match[fmt.day], 10);
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

/** ¿La primera columna es una cabecera de grupo muscular (no un ejercicio)? */
export function isHeaderLine(firstCol: string): boolean {
  const lower = firstCol.toLowerCase();
  const headers = [
    'tren superior',
    'tren inferior',
    'pecho',
    'espalda',
    'hombro',
    'multiarticulares',
    'isquio',
    'femoral',
    'abductores',
    'adductores',
    'cuádriceps',
    'gemelos',
    'tibiales',
    'bíceps',
    'tríceps',
    'piernas',
    'brazo',
    'espalda baja',
    'glúteos',
    'core',
    'abdomen',
  ];
  return headers.some((h) => lower.includes(h));
}

export interface ExportCsvSet {
  exercise?: { name?: string | null } | null;
  reps?: number | null;
  weight?: number | null;
  workout?: { started_at?: string | null } | null;
}

/** Construye el CSV de exportación (con BOM y cabecera). Cadena pura. */
export function buildExportCsv(sets: ExportCsvSet[], unknownLabel = 'Desconocido'): string {
  const BOM_CHAR = String.fromCharCode(0xfeff); // marca BOM para que Excel abra UTF-8
  let csv = BOM_CHAR + 'Fecha,Ejercicio,Repeticiones,Peso\n';
  for (const s of sets) {
    const exName = s.exercise?.name || unknownLabel;
    const safeName = exName.replace(/"/g, '""');
    const dateFormatted = s.workout?.started_at ? s.workout.started_at.split('T')[0] : '';
    csv += `${dateFormatted},"${safeName}",${s.reps ?? 0},${s.weight ?? 0}\n`;
  }
  return csv;
}

export interface ExportJsonWorkout {
  started_at: string | null;
  ended_at?: string | null;
  sets: {
    exercise?: { name?: string | null } | null;
    set_num: number;
    reps: number;
    weight: number;
    is_warmup?: boolean | null;
    rpe?: unknown;
    notes?: string | null;
  }[];
}

/** Serializa workouts + cardio al payload JSON de exportación (v2). Cadena pura. */
export function buildExportJson(
  workouts: ExportJsonWorkout[],
  cardio: unknown,
  now: Date = new Date(),
): string {
  const payload = {
    app: 'GymLog',
    version: 2,
    exported_at: now.toISOString(),
    workouts: workouts.map((w) => ({
      started_at: w.started_at,
      finished_at: w.ended_at ?? null,
      sets: [...w.sets]
        .sort((a, b) => a.set_num - b.set_num)
        .map((s) => ({
          exercise: s.exercise?.name ?? null,
          set_num: s.set_num,
          reps: s.reps,
          weight: s.weight,
          is_warmup: s.is_warmup ?? false,
          rpe: typeof s.rpe === 'number' ? s.rpe : null,
          notes: s.notes ?? null,
        })),
    })),
    cardio,
  };
  return JSON.stringify(payload, null, 2);
}
