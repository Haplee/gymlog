import { describe, it, expect } from 'vitest';
import {
  parseCellSets,
  parseStrengthMatrix,
  parseCardioMatrix,
  parseRoutinesMatrix,
} from '../excelImport';
import { buildWorkoutGrid, formatCellSets, formatGridDate } from '../excelExport';
import type { ExcelStrengthSet } from '../excelExport';

describe('parseCellSets', () => {
  it('parsea pares pesoxreps separados por coma', () => {
    expect(parseCellSets('80x8, 75x10')).toEqual([
      { weight: 80, reps: 8 },
      { weight: 75, reps: 10 },
    ]);
  });

  it('acepta decimales con coma y punto', () => {
    expect(parseCellSets('12,5x10')).toEqual([{ weight: 12.5, reps: 10 }]);
    expect(parseCellSets('12.5x10')).toEqual([{ weight: 12.5, reps: 10 }]);
  });

  it('texto libre estilo ejemplo_exel → una serie con reps por defecto', () => {
    expect(parseCellSets('27,5(por lado )')).toEqual([{ weight: 27.5, reps: 10 }]);
  });

  it('celdas sin peso devuelven vacío', () => {
    expect(parseCellSets('No')).toEqual([]);
    expect(parseCellSets('xxxxxx')).toEqual([]);
    expect(parseCellSets('')).toEqual([]);
  });
});

describe('parseStrengthMatrix', () => {
  it('parsea formato export GymLog (cabecera Ejercicio + fechas)', () => {
    const rows = [
      ['Ejercicio', '28/08/2025', '30/08/2025'],
      ['Bíceps'],
      ['Curl martillo', '12.5x10, 12.5x8', ''],
      ['Curl barra', '', '20x10'],
    ];
    expect(parseStrengthMatrix(rows)).toEqual([
      { date: '2025-08-28', exercise: 'Curl martillo', reps: 10, weight: 12.5 },
      { date: '2025-08-28', exercise: 'Curl martillo', reps: 8, weight: 12.5 },
      { date: '2025-08-30', exercise: 'Curl barra', reps: 10, weight: 20 },
    ]);
  });

  it('parsea hoja manual estilo ejemplo_exel (secciones con fechas propias)', () => {
    const rows = [
      ['Tren superior', '', '28/08/2025', '30/08/2025'],
      ['Bíceps'],
      ['Curl martillo', '', '7,5', 'No'],
      ['Tren inferior', '', '27/08/2025'],
      ['Cuádriceps'],
      ['Prensa', '', '75 con barra'],
    ];
    expect(parseStrengthMatrix(rows)).toEqual([
      { date: '2025-08-28', exercise: 'Curl martillo', reps: 10, weight: 7.5 },
      { date: '2025-08-27', exercise: 'Prensa', reps: 10, weight: 75 },
    ]);
  });
});

describe('round-trip export → import', () => {
  it('recupera exactamente las series exportadas', () => {
    const original: ExcelStrengthSet[] = [
      {
        date: '2026-07-01',
        exercise: 'Press banca',
        muscleGroup: 'Pecho',
        setNum: 1,
        reps: 8,
        weight: 80,
      },
      {
        date: '2026-07-01',
        exercise: 'Press banca',
        muscleGroup: 'Pecho',
        setNum: 2,
        reps: 6,
        weight: 85,
      },
      {
        date: '2026-07-03',
        exercise: 'Sentadilla',
        muscleGroup: 'Cuádriceps',
        setNum: 1,
        reps: 10,
        weight: 100,
      },
    ];
    const grid = buildWorkoutGrid(original);
    const matrix: string[][] = [
      ['Ejercicio', ...grid.dates.map(formatGridDate)],
      ...grid.sections.flatMap((section) => [
        [section.muscleGroup],
        ...section.rows.map((row) => [row.exercise, ...row.cells.map((c) => c ?? '')]),
      ]),
    ];
    const parsed = parseStrengthMatrix(matrix);
    expect(parsed).toHaveLength(3);
    expect(parsed).toEqual(
      expect.arrayContaining([
        { date: '2026-07-01', exercise: 'Press banca', reps: 8, weight: 80 },
        { date: '2026-07-01', exercise: 'Press banca', reps: 6, weight: 85 },
        { date: '2026-07-03', exercise: 'Sentadilla', reps: 10, weight: 100 },
      ]),
    );
  });
});

describe('buildWorkoutGrid', () => {
  it('agrupa por grupo muscular y ordena fechas', () => {
    const grid = buildWorkoutGrid([
      {
        date: '2026-07-03',
        exercise: 'Curl',
        muscleGroup: 'Bíceps',
        setNum: 1,
        reps: 10,
        weight: 12.5,
      },
      {
        date: '2026-07-01',
        exercise: 'Curl',
        muscleGroup: 'Bíceps',
        setNum: 1,
        reps: 10,
        weight: 12,
      },
    ]);
    expect(grid.dates).toEqual(['2026-07-01', '2026-07-03']);
    expect(grid.sections).toHaveLength(1);
    expect(grid.sections[0].muscleGroup).toBe('Bíceps');
    expect(grid.sections[0].rows[0].cells).toEqual(['12x10', '12.5x10']);
  });

  it('formatCellSets serializa varias series', () => {
    expect(
      formatCellSets([
        { weight: 80, reps: 8 },
        { weight: 75, reps: 10 },
      ]),
    ).toBe('80x8, 75x10');
  });
});

describe('parseCardioMatrix', () => {
  it('parsea filas con cabecera nombrada', () => {
    const rows = [
      [
        'Fecha',
        'Tipo',
        'Duración (min)',
        'Distancia (km)',
        'Calorías',
        'FC media',
        'FC máx',
        'Notas',
      ],
      ['01/07/2026', 'Correr', '30', '5.2', '', '', '', 'suave'],
      ['', '', '', '', '', '', '', ''],
    ];
    expect(parseCardioMatrix(rows)).toEqual([
      {
        date: '2026-07-01',
        typeLabel: 'Correr',
        durationMin: 30,
        distanceKm: 5.2,
        calories: null,
        notes: 'suave',
      },
    ]);
  });

  it('sin cabecera reconocible devuelve vacío', () => {
    expect(
      parseCardioMatrix([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toEqual([]);
  });
});

describe('parseRoutinesMatrix', () => {
  it('reconstruye rutinas agrupando por nombre y día', () => {
    const now = new Date('2026-07-07T00:00:00Z');
    const rows = [
      ['Rutina', 'Descripción', 'Día', 'Ejercicio', 'Series', 'Reps', 'Notas'],
      ['Torso', 'Upper', 'Lunes', 'Press banca', '4', '8-10', ''],
      ['Torso', 'Upper', 'Lunes', 'Remo', '3', '10', 'estricto'],
      ['Torso', 'Upper', 'Jueves', 'Press militar', '3', '8', ''],
    ];
    const routines = parseRoutinesMatrix(rows, now);
    expect(routines).toHaveLength(1);
    const routine = routines[0];
    expect(routine.name).toBe('Torso');
    expect(routine.isCustom).toBe(true);
    expect(routine.days.monday.exercises).toEqual([
      { name: 'Press banca', sets: 4, reps: '8-10', notes: undefined },
      { name: 'Remo', sets: 3, reps: '10', notes: 'estricto' },
    ]);
    expect(routine.days.thursday.exercises).toHaveLength(1);
    expect(routine.days.tuesday.exercises).toEqual([]);
  });
});
