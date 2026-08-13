import { describe, it, expect } from 'vitest';
import { groupSetsBySession } from '../sessionGrouping';

const set = (workout_id: string, weight = 80, reps = 8) => ({
  workout_id,
  weight,
  reps,
  rir: 2,
  rpe: null,
});

describe('groupSetsBySession', () => {
  it('agrupa las series de un mismo entreno en una sola sesión', () => {
    const result = groupSetsBySession(
      [set('w1'), set('w1', 82.5), set('w2')],
      [
        { id: 'w1', started_at: '2026-07-20T10:00:00Z' },
        { id: 'w2', started_at: '2026-07-18T10:00:00Z' },
      ],
      8,
    );

    expect(result).toHaveLength(2);
    expect(result[0].sets).toHaveLength(2);
    expect(result[1].sets).toHaveLength(1);
  });

  it('devuelve las sesiones de más reciente a más antigua', () => {
    const result = groupSetsBySession(
      [set('viejo'), set('nuevo')],
      [
        { id: 'viejo', started_at: '2026-01-01T10:00:00Z' },
        { id: 'nuevo', started_at: '2026-07-20T10:00:00Z' },
      ],
      8,
    );

    expect(result.map((s) => s.started_at)).toEqual([
      '2026-07-20T10:00:00Z',
      '2026-01-01T10:00:00Z',
    ]);
  });

  it('descarta las series de un entreno sin fecha', () => {
    // El motor mide huecos entre sesiones: una fecha inventada le haría creer
    // que hubo un parón que nunca existió.
    const result = groupSetsBySession(
      [set('sin-fecha'), set('con-fecha')],
      [
        { id: 'sin-fecha', started_at: null },
        { id: 'con-fecha', started_at: '2026-07-20T10:00:00Z' },
      ],
      8,
    );

    expect(result).toHaveLength(1);
    expect(result[0].started_at).toBe('2026-07-20T10:00:00Z');
  });

  it('descarta las series cuyo entreno no está en la lista', () => {
    const result = groupSetsBySession([set('huerfana')], [], 8);
    expect(result).toEqual([]);
  });

  it('funde en una sola sesión los entrenos del mismo día', () => {
    // Caso real: Press militar el 11-ago a 57,5 kg × 6 por la mañana y a
    // 40 kg × 10 más tarde. Son el mismo día de entreno, no dos sesiones.
    const result = groupSetsBySession(
      [set('manana', 57.5, 6), set('manana', 57.5, 6), set('tarde', 40, 10), set('tarde', 40, 9)],
      [
        { id: 'manana', started_at: '2026-08-11T07:15:50Z' },
        { id: 'tarde', started_at: '2026-08-11T08:40:11Z' },
      ],
      8,
    );

    expect(result).toHaveLength(1);
    expect(result[0].sets).toHaveLength(4);
    // La serie más pesada del día es la que manda en la sugerencia.
    expect(Math.max(...result[0].sets.map((s) => s.weight))).toBe(57.5);
  });

  it('marca la sesión con el inicio más temprano del día', () => {
    const result = groupSetsBySession(
      [set('tarde'), set('manana')],
      [
        { id: 'tarde', started_at: '2026-08-11T20:06:25Z' },
        { id: 'manana', started_at: '2026-08-11T07:15:50Z' },
      ],
      8,
    );

    expect(result).toHaveLength(1);
    expect(result[0].started_at).toBe('2026-08-11T07:15:50Z');
  });

  it('un entreno guardado dos veces no cuenta como dos sesiones', () => {
    // Duplicados reales del historial: mismas series, 29 segundos de diferencia.
    const result = groupSetsBySession(
      [set('a', 85, 5), set('b', 85, 5)],
      [
        { id: 'a', started_at: '2026-08-11T07:15:50Z' },
        { id: 'b', started_at: '2026-08-11T07:16:19Z' },
      ],
      8,
    );

    expect(result).toHaveLength(1);
  });

  it('mantiene separados los días distintos', () => {
    const result = groupSetsBySession(
      [set('lunes'), set('martes')],
      [
        { id: 'lunes', started_at: '2026-08-10T10:00:00Z' },
        { id: 'martes', started_at: '2026-08-11T10:00:00Z' },
      ],
      8,
    );

    expect(result).toHaveLength(2);
  });

  it('descarta entrenos con fecha inválida', () => {
    const result = groupSetsBySession(
      [set('rota'), set('buena')],
      [
        { id: 'rota', started_at: 'no-es-una-fecha' },
        { id: 'buena', started_at: '2026-08-11T10:00:00Z' },
      ],
      8,
    );

    expect(result).toHaveLength(1);
    expect(result[0].started_at).toBe('2026-08-11T10:00:00Z');
  });

  it('recorta al límite quedándose con las más recientes', () => {
    const workouts = Array.from({ length: 10 }, (_, i) => ({
      id: `w${i}`,
      started_at: `2026-07-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    }));
    const result = groupSetsBySession(
      workouts.map((w) => set(w.id)),
      workouts,
      3,
    );

    expect(result).toHaveLength(3);
    expect(result[0].started_at).toBe('2026-07-10T10:00:00Z');
  });
});
