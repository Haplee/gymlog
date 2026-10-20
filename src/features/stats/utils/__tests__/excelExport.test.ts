import { describe, it, expect } from 'vitest';
import {
  arrayBufferToBase64,
  buildWorkoutGrid,
  formatCellSets,
  formatGridDate,
  exportAllToXlsx,
  CARDIO_HEADERS,
  ROUTINE_HEADERS,
  SHEET_CARDIO,
  SHEET_ROUTINES,
  SHEET_STRENGTH,
  type ExcelStrengthSet,
} from '../excelExport';

const set = (
  date: string,
  exercise: string,
  muscleGroup: string,
  setNum: number,
  weight: number,
  reps: number,
): ExcelStrengthSet => ({ date, exercise, muscleGroup, setNum, reps, weight });

describe('formatGridDate', () => {
  it('pasa de ISO a DD/MM/AAAA', () => {
    expect(formatGridDate('2026-08-14')).toBe('14/08/2026');
  });

  it('no reinterpreta la fecha en otra zona horaria', () => {
    // Un 1 de enero a medianoche UTC sigue siendo 1 de enero: el formato es
    // puro texto, sin `new Date()` en medio.
    expect(formatGridDate('2026-01-01')).toBe('01/01/2026');
  });
});

describe('formatCellSets', () => {
  it('serializa las series como pesoxreps separadas por coma', () => {
    expect(
      formatCellSets([
        { weight: 80, reps: 8 },
        { weight: 75, reps: 10 },
      ]),
    ).toBe('80x8, 75x10');
  });

  it('devuelve cadena vacía sin series', () => {
    expect(formatCellSets([])).toBe('');
  });
});

describe('buildWorkoutGrid', () => {
  it('ordena fechas ascendente y agrupa por músculo y ejercicio', () => {
    const grid = buildWorkoutGrid([
      set('2026-08-14', 'Press banca', 'Pecho', 1, 80, 8),
      set('2026-08-12', 'Press banca', 'Pecho', 1, 78, 8),
      set('2026-08-14', 'Sentadilla', 'Pierna', 1, 100, 5),
    ]);

    expect(grid.dates).toEqual(['2026-08-12', '2026-08-14']);
    // Secciones alfabéticas: Pecho antes que Pierna.
    expect(grid.sections.map((s) => s.muscleGroup)).toEqual(['Pecho', 'Pierna']);

    const pecho = grid.sections[0];
    const banca = pecho.rows.find((r) => r.exercise === 'Press banca');
    // Celda de una fecha sin registro = null (el .xlsx escribe cadena vacía).
    expect(banca?.cells).toEqual(['78x8', '80x8']);
    const sentadilla = grid.sections[1].rows[0];
    expect(sentadilla.cells).toEqual([null, '100x5']);
  });

  it('respeta el orden de las series dentro de una misma fecha', () => {
    const grid = buildWorkoutGrid([
      // Llegan desordenadas, como pueden venir de la consulta.
      set('2026-08-14', 'Press banca', 'Pecho', 3, 70, 12),
      set('2026-08-14', 'Press banca', 'Pecho', 1, 80, 8),
      set('2026-08-14', 'Press banca', 'Pecho', 2, 80, 9),
    ]);

    const row = grid.sections[0].rows[0];
    expect(row.cells).toEqual(['80x8, 80x9, 70x12']);
  });

  it('usa el grupo por defecto cuando el ejercicio no trae músculo', () => {
    const grid = buildWorkoutGrid([set('2026-08-14', 'Raro', '', 1, 10, 10)]);
    expect(grid.sections).toHaveLength(1);
    expect(grid.sections[0].muscleGroup).not.toBe('');
  });

  it('con lista vacía devuelve un grid vacío, no `undefined`', () => {
    expect(buildWorkoutGrid([])).toEqual({ dates: [], sections: [] });
  });
});

describe('arrayBufferToBase64', () => {
  it('codifica bytes como base64 (no como texto)', () => {
    const buffer = new Uint8Array([0, 1, 255, 128]).buffer;
    expect(arrayBufferToBase64(buffer)).toBe('AAH/gA==');
  });

  it('maneja buffers mayores que el trozo interno', () => {
    // 0x8000 + 1 bytes: obliga a recorrer el bucle de chunks dos veces.
    const bytes = new Uint8Array(0x8000 + 1).fill(65);
    const base64 = arrayBufferToBase64(bytes.buffer);
    expect(base64.length).toBeGreaterThan(0);
    expect(atob(base64)).toHaveLength(0x8000 + 1);
  });
});

describe('exportAllToXlsx', () => {
  const readBack = async (buffer: ArrayBuffer) => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb;
  };

  // exceljs es el import más pesado del proyecto: generar el libro y volver a
  // leerlo ronda los 8 s en jsdom, muy por encima del timeout de 5 s por
  // defecto. Sin este margen el test falla siempre, no por lo que mide.
  it('genera las tres hojas con sus cabeceras y filas', async () => {
    const buffer = await exportAllToXlsx({
      strength: [set('2026-08-14', 'Press banca', 'Pecho', 1, 80, 8)],
      cardio: [
        {
          date: '2026-08-14',
          typeLabel: 'Correr',
          durationMin: 30,
          distanceKm: 5,
          calories: 300,
          avgHr: 150,
          maxHr: 175,
          notes: 'Suave',
        },
      ],
      routines: [
        {
          routine: 'Mi rutina',
          description: 'Fullbody',
          dayLabel: 'Lunes',
          exercise: 'Press banca',
          sets: 3,
          reps: '8-10',
          notes: null,
        },
      ],
    });

    const wb = await readBack(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      SHEET_STRENGTH,
      SHEET_CARDIO,
      SHEET_ROUTINES,
    ]);

    // La cabecera de la hoja de fuerza lleva el ejercicio + la fecha formateada.
    const strengthHeader = wb.getWorksheet(SHEET_STRENGTH)?.getRow(1).values as unknown[];
    expect(strengthHeader).toEqual([undefined, 'Ejercicio', '14/08/2026']);

    // La fila del ejercicio se escribe con sus series serializadas.
    const strengthValues = (wb.getWorksheet(SHEET_STRENGTH)?.getSheetValues() ?? []) as unknown[][];
    const bancaRow = strengthValues.find((r) => Array.isArray(r) && r[1] === 'Press banca');
    expect(bancaRow).toEqual([undefined, 'Press banca', '80x8']);

    const cardioHeader = wb.getWorksheet(SHEET_CARDIO)?.getRow(1).values as unknown[];
    expect(cardioHeader).toEqual([undefined, ...CARDIO_HEADERS]);

    const routineHeader = wb.getWorksheet(SHEET_ROUTINES)?.getRow(1).values as unknown[];
    expect(routineHeader).toEqual([undefined, ...ROUTINE_HEADERS]);
  }, 30_000);

  it('exporta hojas vacías sin filas de datos', async () => {
    const buffer = await exportAllToXlsx({ strength: [], cardio: [], routines: [] });
    const wb = await readBack(buffer);
    for (const name of [SHEET_STRENGTH, SHEET_CARDIO, SHEET_ROUTINES]) {
      const ws = wb.getWorksheet(name);
      // Sólo la cabecera (la hoja de fuerza, además, sin fechas).
      expect(ws?.actualRowCount).toBe(1);
    }
  });
});
