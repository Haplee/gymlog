// Importación desde Excel (.xlsx). Los parsers operan sobre matrices de strings
// (puros, testables); la lectura del fichero con exceljs es una capa fina async.
// Soporta tanto el formato exportado por GymLog como hojas manuales tipo
// ejemplo_exel (secciones musculares, fechas en columnas, pesos en texto libre).

import { parseImportNumber, parseImportDate, isHeaderLine } from './exportImport';
import type { DayOfWeek, Routine, DayRoutine } from '@features/routine/stores/routineStore';

export type SheetMatrix = string[][];

export interface ParsedStrengthSet {
  date: string; // YYYY-MM-DD
  exercise: string;
  reps: number;
  weight: number;
}

export interface ParsedCardioSession {
  date: string; // YYYY-MM-DD
  typeLabel: string;
  durationMin: number;
  distanceKm: number | null;
  calories: number | null;
  notes: string | null;
}

export interface ParsedImport {
  strength: ParsedStrengthSet[];
  cardio: ParsedCardioSession[];
  routines: Routine[];
}

const DEFAULT_REPS = 10; // mismo default que el import CSV existente

/** Parsea una celda de series: "80x8, 75x10" → pares; texto libre → 1 serie. */
export function parseCellSets(text: string): { weight: number; reps: number }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const pairRegex = /(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+)/g;
  const pairs: { weight: number; reps: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(trimmed)) !== null) {
    const weight = parseFloat(match[1].replace(',', '.'));
    const reps = parseInt(match[2], 10);
    if (weight > 0 && weight < 2000 && reps > 0 && reps < 200) {
      pairs.push({ weight: Math.round(weight * 10) / 10, reps });
    }
  }
  if (pairs.length > 0) return pairs;
  // Texto libre estilo ejemplo_exel: "27,5(por lado )", "75 con barra", "No"…
  const weight = parseImportNumber(trimmed);
  return weight !== null ? [{ weight, reps: DEFAULT_REPS }] : [];
}

/**
 * Parsea la hoja de fuerza. Cada fila con ≥1 fecha reconocible en columnas 2+
 * redefine el mapeo columna→fecha (cabeceras "Tren superior | 28/08 | 30/08" o
 * "Ejercicio | 28/08/2025 | …"). Las filas de ejercicio usan el mapeo vigente.
 */
export function parseStrengthMatrix(rows: SheetMatrix): ParsedStrengthSet[] {
  const result: ParsedStrengthSet[] = [];
  let dateByCol = new Map<number, string>();

  for (const row of rows) {
    const firstCol = (row[0] ?? '').trim();

    const rowDates = new Map<number, string>();
    for (let c = 1; c < row.length; c++) {
      const date = parseImportDate((row[c] ?? '').trim());
      if (date) rowDates.set(c, date);
    }
    const isDateHeader =
      rowDates.size > 0 &&
      (firstCol === '' || firstCol.toLowerCase() === 'ejercicio' || isHeaderLine(firstCol));
    if (isDateHeader) {
      dateByCol = rowDates;
      continue;
    }

    if (!firstCol || firstCol.length < 2 || isHeaderLine(firstCol)) continue;

    for (const [col, date] of dateByCol) {
      const cell = (row[col] ?? '').trim();
      if (!cell) continue;
      for (const s of parseCellSets(cell)) {
        result.push({ date, exercise: firstCol, reps: s.reps, weight: s.weight });
      }
    }
  }
  return result;
}

/** Localiza índices de columnas por nombre de cabecera (contains, lowercase). */
function mapHeaderCols(header: string[], needles: string[]): (number | null)[] {
  const lower = header.map((h) => (h ?? '').toLowerCase());
  return needles.map((n) => {
    const idx = lower.findIndex((h) => h.includes(n));
    return idx === -1 ? null : idx;
  });
}

function cellAt(row: string[], idx: number | null): string {
  return idx === null ? '' : (row[idx] ?? '').trim();
}

/** Parsea la hoja Cardio (Fecha, Tipo, Duración, Distancia, Calorías, Notas). */
export function parseCardioMatrix(rows: SheetMatrix): ParsedCardioSession[] {
  if (rows.length < 2) return [];
  const [dateIdx, typeIdx, durIdx, distIdx, calIdx, notesIdx] = mapHeaderCols(rows[0], [
    'fecha',
    'tipo',
    'duraci',
    'dista',
    'calor',
    'nota',
  ]);
  if (dateIdx === null || durIdx === null) return [];

  const result: ParsedCardioSession[] = [];
  for (const row of rows.slice(1)) {
    const date = parseImportDate(cellAt(row, dateIdx));
    const durationMin = parseImportNumber(cellAt(row, durIdx));
    if (!date || durationMin === null) continue;
    result.push({
      date,
      typeLabel: cellAt(row, typeIdx),
      durationMin,
      distanceKm: parseImportNumber(cellAt(row, distIdx)),
      calories: parseImportNumber(cellAt(row, calIdx)),
      notes: cellAt(row, notesIdx) || null,
    });
  }
  return result;
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const DAY_BY_LABEL = new Map<string, DayOfWeek>(
  (Object.entries(DAY_LABELS) as [DayOfWeek, string][]).map(([day, label]) => [
    label.toLowerCase(),
    day,
  ]),
);

function emptyDays(): Record<DayOfWeek, DayRoutine> {
  const days = {} as Record<DayOfWeek, DayRoutine>;
  for (const day of Object.keys(DAY_LABELS) as DayOfWeek[]) {
    days[day] = { name: '', exercises: [] };
  }
  return days;
}

/** Parsea la hoja Rutinas (Rutina, Descripción, Día, Ejercicio, Series, Reps, Notas). */
export function parseRoutinesMatrix(rows: SheetMatrix, now: Date = new Date()): Routine[] {
  if (rows.length < 2) return [];
  const [nameIdx, descIdx, dayIdx, exIdx, setsIdx, repsIdx, notesIdx] = mapHeaderCols(rows[0], [
    'rutina',
    'descrip',
    'día',
    'ejercicio',
    'serie',
    'rep',
    'nota',
  ]);
  if (nameIdx === null || dayIdx === null || exIdx === null) return [];

  const byName = new Map<string, Routine>();
  for (const row of rows.slice(1)) {
    const name = cellAt(row, nameIdx);
    const dayLabel = cellAt(row, dayIdx).toLowerCase();
    const exercise = cellAt(row, exIdx);
    const day = DAY_BY_LABEL.get(dayLabel);
    if (!name || !day || !exercise) continue;

    const routine = byName.get(name) ?? {
      id: crypto.randomUUID(),
      name,
      description: cellAt(row, descIdx),
      days: emptyDays(),
      isCustom: true,
      createdAt: now.toISOString(),
    };
    const sets = parseImportNumber(cellAt(row, setsIdx));
    routine.days[day] = {
      name: routine.days[day].name || name,
      exercises: [
        ...routine.days[day].exercises,
        {
          name: exercise,
          sets: sets !== null ? Math.round(sets) : undefined,
          reps: cellAt(row, repsIdx) || undefined,
          notes: cellAt(row, notesIdx) || undefined,
        },
      ],
    };
    byName.set(name, routine);
  }
  return [...byName.values()];
}

/** Lee un .xlsx y devuelve datos normalizados de las tres hojas. */
export async function parseXlsxFile(data: ArrayBuffer): Promise<ParsedImport> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const toMatrix = (name: string, fallbackFirst: boolean): SheetMatrix => {
    const ws =
      wb.worksheets.find((w) => w.name.toLowerCase() === name.toLowerCase()) ??
      (fallbackFirst ? wb.worksheets[0] : undefined);
    if (!ws) return [];
    const matrix: SheetMatrix = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let text = cell.text ?? '';
        // Fechas nativas de Excel → DD/MM/YYYY para parseImportDate
        if (cell.value instanceof Date) {
          const d = cell.value;
          text = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
        }
        cells[colNumber - 1] = String(text).trim();
      });
      matrix.push(Array.from(cells, (c) => c ?? ''));
    });
    return matrix;
  };

  return {
    strength: parseStrengthMatrix(toMatrix('Entrenamientos', true)),
    cardio: parseCardioMatrix(toMatrix('Cardio', false)),
    routines: parseRoutinesMatrix(toMatrix('Rutinas', false)),
  };
}
