// Exportación a Excel (.xlsx) con exceljs (import dinámico: solo carga al exportar).
// La hoja "Entrenamientos" replica la estructura de ejemplo_exel: secciones por
// grupo muscular, filas de ejercicio y columnas por fecha. Cada celda lleva las
// series como "pesoxreps" separadas por coma para que el import sea sin pérdida.

import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';

export interface ExcelStrengthSet {
  date: string; // YYYY-MM-DD
  exercise: string;
  muscleGroup: string;
  setNum: number;
  reps: number;
  weight: number;
}

export interface ExcelCardioRow {
  date: string; // YYYY-MM-DD
  typeLabel: string;
  durationMin: number;
  distanceKm: number | null;
  calories: number | null;
  avgHr: number | null;
  maxHr: number | null;
  notes: string | null;
}

export interface ExcelRoutineRow {
  routine: string;
  description: string;
  dayLabel: string;
  exercise: string;
  sets: number | null;
  reps: string | null;
  notes: string | null;
}

export interface WorkoutGridRow {
  exercise: string;
  cells: (string | null)[];
}

export interface WorkoutGridSection {
  muscleGroup: string;
  rows: WorkoutGridRow[];
}

export interface WorkoutGrid {
  dates: string[]; // YYYY-MM-DD ascendente
  sections: WorkoutGridSection[];
}

export const SHEET_STRENGTH = 'Entrenamientos';
export const SHEET_CARDIO = 'Cardio';
export const SHEET_ROUTINES = 'Rutinas';

export const CARDIO_HEADERS = [
  'Fecha',
  'Tipo',
  'Duración (min)',
  'Distancia (km)',
  'Calorías',
  'FC media',
  'FC máx',
  'Notas',
] as const;

export const ROUTINE_HEADERS = [
  'Rutina',
  'Descripción',
  'Día',
  'Ejercicio',
  'Series',
  'Reps',
  'Notas',
] as const;

/** ArrayBuffer → base64 (para Filesystem.writeFile binario en nativo). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

/** YYYY-MM-DD → DD/MM/YYYY (formato de fecha del ejemplo). */
export function formatGridDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Serializa las series de un ejercicio/fecha: "80x8, 80x8, 75x10". */
export function formatCellSets(sets: { weight: number; reps: number }[]): string {
  return sets.map((s) => `${s.weight}x${s.reps}`).join(', ');
}

/** Construye el grid (puro, testable): secciones por grupo muscular × fechas. */
export function buildWorkoutGrid(sets: ExcelStrengthSet[]): WorkoutGrid {
  const dates = [...new Set(sets.map((s) => s.date))].sort();
  const dateIndex = new Map(dates.map((d, i) => [d, i]));

  // muscleGroup → exercise → date → sets
  const byGroup = new Map<string, Map<string, Map<string, ExcelStrengthSet[]>>>();
  for (const s of sets) {
    const group = s.muscleGroup || DEFAULT_MUSCLE_GROUP;
    const byExercise = byGroup.get(group) ?? new Map<string, Map<string, ExcelStrengthSet[]>>();
    const byDate = byExercise.get(s.exercise) ?? new Map<string, ExcelStrengthSet[]>();
    const list = byDate.get(s.date) ?? [];
    byDate.set(s.date, [...list, s]);
    byExercise.set(s.exercise, byDate);
    byGroup.set(group, byExercise);
  }

  const sections: WorkoutGridSection[] = [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([muscleGroup, byExercise]) => ({
      muscleGroup,
      rows: [...byExercise.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([exercise, byDate]) => {
          const cells: (string | null)[] = dates.map(() => null);
          for (const [date, dateSets] of byDate) {
            const idx = dateIndex.get(date);
            if (idx === undefined) continue;
            const ordered = [...dateSets].sort((a, b) => a.setNum - b.setNum);
            cells[idx] = formatCellSets(ordered);
          }
          return { exercise, cells };
        }),
    }));

  return { dates, sections };
}

export interface ExcelExportData {
  strength: ExcelStrengthSet[];
  cardio: ExcelCardioRow[];
  routines: ExcelRoutineRow[];
}

const HEADER_BLUE = 'FF4A86E8';
const SECTION_BLUE = 'FFC9DAF8';
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

/** Genera el workbook .xlsx completo. Devuelve el buffer listo para guardar. */
export async function exportAllToXlsx(data: ExcelExportData): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GymLog';
  wb.created = new Date();

  // --- Hoja Entrenamientos (estructura ejemplo_exel) ---
  const grid = buildWorkoutGrid(data.strength);
  const ws = wb.addWorksheet(SHEET_STRENGTH);
  ws.getColumn(1).width = 34;
  for (let i = 0; i < grid.dates.length; i++) ws.getColumn(i + 2).width = 16;

  const headerRow = ws.addRow(['Ejercicio', ...grid.dates.map(formatGridDate)]);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  });

  for (const section of grid.sections) {
    const sectionRow = ws.addRow([section.muscleGroup]);
    sectionRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_BLUE } };
    });
    for (const row of section.rows) {
      ws.addRow([row.exercise, ...row.cells.map((c) => c ?? '')]);
    }
  }

  // --- Hoja Cardio ---
  const wsCardio = wb.addWorksheet(SHEET_CARDIO);
  const cardioHeader = wsCardio.addRow([...CARDIO_HEADERS]);
  cardioHeader.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  });
  for (let i = 1; i <= CARDIO_HEADERS.length; i++) wsCardio.getColumn(i).width = i === 8 ? 30 : 14;
  for (const c of data.cardio) {
    wsCardio.addRow([
      formatGridDate(c.date),
      c.typeLabel,
      c.durationMin,
      c.distanceKm ?? '',
      c.calories ?? '',
      c.avgHr ?? '',
      c.maxHr ?? '',
      c.notes ?? '',
    ]);
  }

  // --- Hoja Rutinas ---
  const wsRoutines = wb.addWorksheet(SHEET_ROUTINES);
  const routineHeader = wsRoutines.addRow([...ROUTINE_HEADERS]);
  routineHeader.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  });
  for (let i = 1; i <= ROUTINE_HEADERS.length; i++)
    wsRoutines.getColumn(i).width = i === 4 ? 30 : 16;
  for (const r of data.routines) {
    wsRoutines.addRow([
      r.routine,
      r.description,
      r.dayLabel,
      r.exercise,
      r.sets ?? '',
      r.reps ?? '',
      r.notes ?? '',
    ]);
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
