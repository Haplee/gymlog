import { describe, it, expect } from 'vitest';
import {
  tokenizeCsvLine,
  parseImportNumber,
  parseImportDate,
  isHeaderLine,
  buildExportCsv,
  buildExportJson,
  makeDedupKey,
  buildExistingDedupKeys,
  estimateDedupSkips,
} from '../exportImport';

describe('tokenizeCsvLine', () => {
  it('separa por comas y hace trim', () => {
    expect(tokenizeCsvLine('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('respeta comas dentro de comillas', () => {
    expect(tokenizeCsvLine('2026-01-01,"Press, banca",5,100')).toEqual([
      '2026-01-01',
      'Press, banca',
      '5',
      '100',
    ]);
  });

  it('siempre devuelve la última celda', () => {
    expect(tokenizeCsvLine('a,b,')).toEqual(['a', 'b', '']);
  });
});

describe('parseImportNumber', () => {
  it('parsea números válidos con 1 decimal', () => {
    expect(parseImportNumber('100')).toBe(100);
    expect(parseImportNumber('80,5')).toBe(80.5);
    expect(parseImportNumber('72.49')).toBe(72.5);
  });

  it('limpia unidades y texto', () => {
    expect(parseImportNumber('100 kg')).toBe(100);
  });

  it('rechaza vacío, cero, negativos y fuera de rango', () => {
    expect(parseImportNumber('')).toBeNull();
    expect(parseImportNumber('n/a')).toBeNull();
    expect(parseImportNumber('0')).toBeNull();
    expect(parseImportNumber('5000')).toBeNull();
    expect(parseImportNumber(undefined)).toBeNull();
  });
});

describe('parseImportDate', () => {
  it('deja pasar ISO YYYY-MM-DD', () => {
    expect(parseImportDate('2026-06-20')).toBe('2026-06-20');
  });

  it('convierte dd/mm/yyyy y dd-mm-yyyy', () => {
    expect(parseImportDate('5/3/2026')).toBe('2026-03-05');
    expect(parseImportDate('05-03-2026')).toBe('2026-03-05');
  });

  it('expande año de 2 dígitos', () => {
    expect(parseImportDate('5/3/26')).toBe('2026-03-05');
  });

  it('rechaza fechas inválidas o basura', () => {
    expect(parseImportDate('')).toBeNull();
    expect(parseImportDate('32/13/2026')).toBeNull();
    expect(parseImportDate('hola')).toBeNull();
  });
});

describe('isHeaderLine', () => {
  it('detecta cabeceras de grupo muscular', () => {
    expect(isHeaderLine('Pecho')).toBe(true);
    expect(isHeaderLine('TREN SUPERIOR')).toBe(true);
  });

  it('no marca un ejercicio normal', () => {
    expect(isHeaderLine('Press banca')).toBe(false);
  });
});

describe('buildExportCsv', () => {
  it('genera cabecera + filas y escapa comillas', () => {
    const csv = buildExportCsv([
      {
        exercise: { name: 'Press "pin"' },
        reps: 5,
        weight: 100,
        workout: { started_at: '2026-06-20T10:00:00Z' },
      },
    ]);
    expect(csv).toContain('Fecha,Ejercicio,Repeticiones,Peso');
    expect(csv).toContain('2026-06-20,"Press ""pin""",5,100');
  });

  it('usa la etiqueta de desconocido cuando falta el nombre', () => {
    const csv = buildExportCsv([{ exercise: null, reps: 0, weight: 0, workout: null }], 'Unknown');
    expect(csv).toContain('"Unknown"');
  });
});

describe('buildExportJson', () => {
  it('serializa con timestamp determinista y ordena sets', () => {
    const json = buildExportJson(
      [
        {
          started_at: '2026-06-20T10:00:00Z',
          ended_at: null,
          sets: [
            { set_num: 2, reps: 5, weight: 100, exercise: { name: 'Press' } },
            { set_num: 1, reps: 8, weight: 80, exercise: { name: 'Press' } },
          ],
        },
      ],
      [],
      new Date('2026-06-20T12:00:00Z'),
    );
    const parsed = JSON.parse(json);
    expect(parsed.app).toBe('GymLog');
    expect(parsed.version).toBe(2);
    expect(parsed.exported_at).toBe('2026-06-20T12:00:00.000Z');
    expect(parsed.workouts[0].sets.map((s: { set_num: number }) => s.set_num)).toEqual([1, 2]);
    expect(parsed.workouts[0].sets[0].exercise).toBe('Press');
  });
});

describe('makeDedupKey', () => {
  it('normaliza ejercicio a minúsculas y une fecha + set_num', () => {
    expect(makeDedupKey('2026-06-20', 'Press Banca', 2)).toBe('2026-06-20|press banca|2');
    expect(makeDedupKey('2026-06-20', '  PRESS BANCA ', 2)).toBe('2026-06-20|press banca|2');
  });
});

describe('buildExistingDedupKeys', () => {
  it('construye claves desde workouts ya cargados', () => {
    const keys = buildExistingDedupKeys([
      {
        started_at: '2026-06-20T10:00:00Z',
        sets: [
          { set_num: 1, exercise: { name: 'Press' } },
          { set_num: 2, exercise: { name: 'SENTADILLA' } },
        ],
      },
    ]);
    expect(keys.size).toBe(2);
    expect(keys.has('2026-06-20|press|1')).toBe(true);
    expect(keys.has('2026-06-20|sentadilla|2')).toBe(true);
  });

  it('ignora workouts sin fecha y sets sin ejercicio', () => {
    const keys = buildExistingDedupKeys([
      { started_at: null, sets: [{ set_num: 1, exercise: { name: 'Press' } }] },
      { started_at: '2026-06-20T10:00:00Z', sets: [{ set_num: 1, exercise: null }] },
    ]);
    expect(keys.size).toBe(0);
  });
});

describe('estimateDedupSkips', () => {
  it('cuenta coincidencias exactas (fecha, ejercicio, set_num)', () => {
    const existing = new Set(['2026-06-20|press|1']);
    const skips = estimateDedupSkips(
      [
        { date: '2026-06-20', exercise: 'Press', setNum: 1 },
        { date: '2026-06-20', exercise: 'Press', setNum: 2 },
        { date: '2026-06-21', exercise: 'Press', setNum: 1 },
      ],
      existing,
    );
    expect(skips).toBe(1);
  });

  it('asigna set_num por contador cuando no viene explícito (Excel/CSV)', () => {
    const existing = new Set(['2026-06-20|press|1']);
    const skips = estimateDedupSkips(
      [
        { date: '2026-06-20', exercise: 'Press' },
        { date: '2026-06-20', exercise: 'Press' },
      ],
      existing,
    );
    // Fila 1 → set_num 1 (duplicada), fila 2 → set_num 2 (nueva).
    expect(skips).toBe(1);
  });

  it('no cuenta duplicados intra-import como nuevos', () => {
    const skips = estimateDedupSkips(
      [
        { date: '2026-06-20', exercise: 'Press', setNum: 1 },
        { date: '2026-06-20', exercise: 'Press', setNum: 1 },
      ],
      new Set(),
    );
    expect(skips).toBe(1);
  });
});
