import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRemoteWorkouts } from '../schemas';

// El validador avisa por consola de lo que descarta; se silencia para no
// ensuciar la salida del runner con avisos esperados.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** Fila tal y como la sirve `get_workouts_with_sets` (to_jsonb + sets anidados). */
function remoteWorkout(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    user_id: 'u1',
    started_at: '2026-08-14T10:00:00.000Z',
    finished_at: '2026-08-14T11:00:00.000Z',
    client_id: null,
    name: null,
    notes: null,
    status: null,
    rating: null,
    duration_seconds: 3600,
    total_volume_kg: null,
    sets: [remoteSet()],
    ...overrides,
  };
}

function remoteSet(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    reps: 5,
    weight: 120,
    set_num: 1,
    exercise_id: 'e1',
    workout_id: 'w1',
    created_at: '2026-08-14T10:05:00.000Z',
    notes: null,
    is_warmup: false,
    rpe: null,
    rir: null,
    exercise: { name: 'Sentadilla', muscle_group: 'Pierna' },
    workout: { started_at: '2026-08-14T10:00:00.000Z' },
    ...overrides,
  };
}

describe('parseRemoteWorkouts', () => {
  it('mapea finished_at a ended_at, que es como lo llama la app', () => {
    const [w] = parseRemoteWorkouts([remoteWorkout()]);

    expect(w.ended_at).toBe('2026-08-14T11:00:00.000Z');
    expect(w.started_at).toBe('2026-08-14T10:00:00.000Z');
    expect(w.sets).toHaveLength(1);
    expect(w.sets[0].exercise.name).toBe('Sentadilla');
  });

  it('acepta una serie sin ejercicio: el join es LEFT y el borrado deja huecos', () => {
    const [w] = parseRemoteWorkouts([
      remoteWorkout({ sets: [remoteSet({ exercise: { name: null, muscle_group: null } })] }),
    ]);

    // No se pierde la serie: solo se queda sin nombre, que aguas abajo cae en
    // el «Desconocido» de siempre.
    expect(w.sets).toHaveLength(1);
    expect(w.sets[0].exercise.name).toBe('');
    expect(w.sets[0].weight).toBe(120);
  });

  it('descarta la serie corrupta pero conserva el resto del entreno', () => {
    const [w] = parseRemoteWorkouts([
      remoteWorkout({
        sets: [remoteSet({ id: 'ok' }), remoteSet({ id: 'mala', reps: 'muchas' })],
      }),
    ]);

    expect(w.sets).toHaveLength(1);
    expect(w.sets[0].id).toBe('ok');
  });

  it('descarta el entreno sin id y deja pasar los demás', () => {
    const workouts = parseRemoteWorkouts([
      remoteWorkout({ id: undefined }),
      remoteWorkout({ id: 'w2' }),
    ]);

    expect(workouts).toHaveLength(1);
    expect(workouts[0].id).toBe('w2');
  });

  it('deja pasar columnas que el esquema no conoce', () => {
    const [w] = parseRemoteWorkouts([remoteWorkout({ columna_futura: 42 })]);

    // Añadir una columna a `workouts` no puede invalidar la fila entera.
    expect((w as unknown as { columna_futura: number }).columna_futura).toBe(42);
  });

  it('una respuesta con forma inesperada deja la pantalla vacía, no la rompe', () => {
    expect(parseRemoteWorkouts(null)).toEqual([]);
    expect(parseRemoteWorkouts({ inesperado: true })).toEqual([]);
    expect(parseRemoteWorkouts('texto')).toEqual([]);
  });

  it('un entreno sin series es válido: se registra la sesión aunque esté vacía', () => {
    const [w] = parseRemoteWorkouts([remoteWorkout({ sets: null })]);
    expect(w.sets).toEqual([]);
  });
});
