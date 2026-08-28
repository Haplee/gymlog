import { describe, it, expect } from 'vitest';
import {
  planModeOf,
  planDurationOf,
  formatSegundos,
  MAX_DURACION_SEGUNDOS,
  groupPlanExercises,
  supersetOrder,
} from '../planTarget';

describe('planModeOf', () => {
  it('un ejercicio sin modo es de repeticiones', () => {
    expect(planModeOf({ name: 'Press banca', sets: 3, reps: '8-10' } as never)).toBe('reps');
  });

  it('undefined y null no revientan', () => {
    expect(planModeOf(undefined)).toBe('reps');
    expect(planModeOf(null)).toBe('reps');
  });

  it('reconoce el modo tiempo', () => {
    expect(planModeOf({ mode: 'time' })).toBe('time');
  });

  it('cardio no es un modo de rutina: cae en reps', () => {
    // Un fichero compartido manipulado podria traerlo. Crear un ejercicio de
    // rutina que ninguna pantalla sabe pintar es peor que ignorar el campo.
    expect(planModeOf({ mode: 'cardio' })).toBe('reps');
  });

  it('un modo inventado cae en reps', () => {
    expect(planModeOf({ mode: 'emom' })).toBe('reps');
  });
});

describe('planDurationOf', () => {
  it('devuelve los segundos de una serie por tiempo', () => {
    expect(planDurationOf({ mode: 'time', durationSeconds: 45 })).toBe(45);
  });

  it('en modo reps no hay duracion aunque el campo venga relleno', () => {
    expect(planDurationOf({ mode: 'reps', durationSeconds: 45 })).toBeNull();
    expect(planDurationOf({ durationSeconds: 45 })).toBeNull();
  });

  it('cero no es una duracion', () => {
    expect(planDurationOf({ mode: 'time', durationSeconds: 0 })).toBeNull();
  });

  it('descarta negativos, NaN y lo que se pase de la hora', () => {
    expect(planDurationOf({ mode: 'time', durationSeconds: -30 })).toBeNull();
    expect(planDurationOf({ mode: 'time', durationSeconds: Number.NaN })).toBeNull();
    expect(planDurationOf({ mode: 'time', durationSeconds: MAX_DURACION_SEGUNDOS + 1 })).toBeNull();
  });

  it('trunca los decimales', () => {
    expect(planDurationOf({ mode: 'time', durationSeconds: 45.9 })).toBe(45);
  });

  it('sin duracion devuelve null, no cero', () => {
    expect(planDurationOf({ mode: 'time' })).toBeNull();
  });
});

describe('formatSegundos', () => {
  it('por debajo del minuto, segundos pelados', () => {
    expect(formatSegundos(45)).toBe('45 s');
    expect(formatSegundos(59)).toBe('59 s');
  });

  it('a partir del minuto, m:ss', () => {
    expect(formatSegundos(60)).toBe('1:00');
    expect(formatSegundos(90)).toBe('1:30');
    expect(formatSegundos(605)).toBe('10:05');
  });
});

describe('groupPlanExercises', () => {
  const ex = (name: string, supersetId?: string) => ({
    name,
    ...(supersetId ? { supersetId } : {}),
  });

  it('sin superseries, cada ejercicio es su propio grupo', () => {
    const grupos = groupPlanExercises([ex('A'), ex('B')]);
    expect(grupos).toHaveLength(2);
    expect(grupos.every((g) => g.supersetId === null)).toBe(true);
  });

  it('dos consecutivos con el mismo id forman un grupo', () => {
    const grupos = groupPlanExercises([ex('A', 's1'), ex('B', 's1'), ex('C')]);

    expect(grupos).toHaveLength(2);
    expect(grupos[0].supersetId).toBe('s1');
    expect(grupos[0].indices).toEqual([0, 1]);
    expect(grupos[1].exercises[0].name).toBe('C');
  });

  it('con un ejercicio en medio NO forman superserie', () => {
    // Es lo que pasa al reordenar la lista. Dejar una superserie que salta por
    // encima de otro ejercicio contradice lo que el usuario acaba de hacer al
    // mover la fila.
    const grupos = groupPlanExercises([ex('A', 's1'), ex('C'), ex('B', 's1')]);

    expect(grupos).toHaveLength(3);
    expect(grupos.every((g) => g.exercises.length === 1)).toBe(true);
  });

  it('los índices apuntan a la lista original, para poder editar en su sitio', () => {
    const grupos = groupPlanExercises([ex('A'), ex('B', 's1'), ex('C', 's1')]);
    expect(grupos[1].indices).toEqual([1, 2]);
  });

  it('una lista vacía no revienta', () => {
    expect(groupPlanExercises([])).toEqual([]);
  });
});

describe('supersetOrder', () => {
  it('recorre en ciclo: A1, B1, A2, B2', () => {
    expect(supersetOrder([2, 2])).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
    ]);
  });

  it('el ejercicio con menos series sale del ciclo, no lo bloquea', () => {
    // 3×A + 2×B es una superserie normal; la tercera vuelta es solo A.
    expect(supersetOrder([3, 2])).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [0, 3],
    ]);
  });

  it('tres ejercicios encadenados también giran', () => {
    expect(supersetOrder([1, 1, 1])).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
  });

  it('sin series no hay orden', () => {
    expect(supersetOrder([])).toEqual([]);
    expect(supersetOrder([0, 0])).toEqual([]);
  });
});
