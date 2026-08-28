import { describe, it, expect } from 'vitest';
import { groupSetsByExercise, repsRange } from '../historyHelpers';
import type { WorkoutSetWithDetails } from '@shared/lib/types';

describe('repsRange', () => {
  it('devuelve string vacío si array vacío', () => {
    expect(repsRange([])).toBe('');
  });

  it('devuelve un solo número si todos iguales', () => {
    expect(repsRange([10, 10, 10])).toBe('10');
  });

  it('devuelve rango min-max si hay variación', () => {
    expect(repsRange([8, 10, 12])).toBe('8-12');
    expect(repsRange([5, 5, 8])).toBe('5-8');
  });
});

/** Serie mínima: solo lo que mira el agrupador. */
function serie(name: string, reps: number, weight: number): WorkoutSetWithDetails {
  return {
    exercise: { name },
    reps,
    weight,
  } as unknown as WorkoutSetWithDetails;
}

describe('groupSetsByExercise', () => {
  it('devuelve una entrada por ejercicio, no una por serie', () => {
    const out = groupSetsByExercise([
      serie('Hip thrust', 8, 115),
      serie('Hip thrust', 9, 115),
      serie('Hip thrust', 10, 115),
    ]);
    expect(out).toEqual([
      {
        name: 'Hip thrust',
        setCount: 3,
        reps: '8-10',
        weight: '115',
        timedSetCount: 0,
        duration: '',
      },
    ]);
  });

  it('conserva el orden de aparición y separa ejercicios distintos', () => {
    const out = groupSetsByExercise([
      serie('Prensa', 8, 165),
      serie('Extensiones', 10, 67.5),
      serie('Prensa', 8, 165),
    ]);
    expect(out.map((e) => e.name)).toEqual(['Prensa', 'Extensiones']);
    expect(out[0].setCount).toBe(2);
  });

  it('da rango también en el peso cuando la carga sube entre series', () => {
    const out = groupSetsByExercise([
      serie('Sentadilla', 5, 100),
      serie('Sentadilla', 5, 110),
      serie('Sentadilla', 3, 120),
    ]);
    expect(out[0]).toEqual({
      name: 'Sentadilla',
      setCount: 3,
      reps: '3-5',
      weight: '100-120',
      timedSetCount: 0,
      duration: '',
    });
  });

  it('ignora series sin nombre de ejercicio en vez de inventar una fila', () => {
    const huerfana = { reps: 8, weight: 50 } as unknown as WorkoutSetWithDetails;
    expect(groupSetsByExercise([huerfana])).toEqual([]);
  });

  it('sin series devuelve lista vacía', () => {
    expect(groupSetsByExercise([])).toEqual([]);
  });
});

describe('groupSetsByExercise — series por tiempo', () => {
  /** Una plancha tal y como sale de la BD: sin repeticiones y con duración. */
  function plancha(name: string, segundos: number, weight = 0) {
    return {
      id: crypto.randomUUID(),
      exercise: { name },
      reps: null,
      duration_seconds: segundos,
      weight,
    } as unknown as WorkoutSetWithDetails;
  }

  it('resume una plancha en segundos, no en repeticiones', () => {
    const out = groupSetsByExercise([plancha('Plancha', 45), plancha('Plancha', 60)]);

    expect(out).toHaveLength(1);
    expect(out[0].timedSetCount).toBe(2);
    expect(out[0].duration).toBe('45-60 s');
    // Lo importante: no se cuela en el recuento de series de repeticiones.
    expect(out[0].setCount).toBe(0);
    expect(out[0].reps).toBe('');
  });

  it('todas iguales se resumen sin rango', () => {
    const out = groupSetsByExercise([plancha('Plancha', 45), plancha('Plancha', 45)]);
    expect(out[0].duration).toBe('45 s');
  });

  it('un ejercicio con las dos formas las mantiene separadas', () => {
    // «8-45» sería el resultado de meterlas en el mismo rango, y no significa
    // nada: ni 8 segundos ni 45 repeticiones.
    const out = groupSetsByExercise([serie('Flexiones', 8, 0), plancha('Flexiones', 45)]);

    expect(out[0].reps).toBe('8');
    expect(out[0].setCount).toBe(1);
    expect(out[0].duration).toBe('45 s');
    expect(out[0].timedSetCount).toBe(1);
  });

  it('el lastre de una plancha cuenta como peso; el cero de una sin lastre no', () => {
    const out = groupSetsByExercise([plancha('Plancha', 45, 20), plancha('Plancha', 45, 0)]);
    expect(out[0].weight).toBe('20');
  });

  it('una serie que no mide nada se descarta en vez de salir como «0 reps»', () => {
    const rota = {
      id: 'x',
      exercise: { name: 'Rara' },
      reps: null,
      duration_seconds: null,
      weight: 50,
    } as unknown as WorkoutSetWithDetails;

    expect(groupSetsByExercise([rota])).toEqual([]);
  });
});
