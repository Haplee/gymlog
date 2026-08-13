/**
 * Paridad de la sugerencia de carga entre la pantalla de entreno y la sesión de
 * rutina.
 *
 * Es el test de regresión del bug: el mismo ejercicio, con el mismo historial,
 * recomendaba 80 kg × 11 en inicio y 82,5 kg en la rutina, porque solo la
 * segunda pasaba el rango de reps objetivo y la primera caía al [8, 12] por
 * defecto de `suggestProgression`.
 *
 * Lo que se comprueba aquí es que ambos caminos resuelven el mismo rango y, con
 * él, la misma sugerencia. No se comprueban las reglas del motor: de eso ya se
 * ocupa `autoregulation.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { resolveExerciseRepRange } from '@shared/lib/exerciseTargets';
import { suggestNextLoad, suggestFromLastSession } from '../autoregulation';
import type { AutoRegSession, LoadSuggestion } from '../autoregulation';
import type { Routine, DayOfWeek, DayRoutine } from '@features/routine/stores/routineStore';

const emptyDay: DayRoutine = { name: 'Descanso', exercises: [] };

function makeRoutine(days: Partial<Record<DayOfWeek, DayRoutine>>): Routine {
  return {
    id: 'activa',
    name: 'Rutina de FranVi',
    description: '',
    isCustom: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    days: {
      monday: emptyDay,
      tuesday: emptyDay,
      wednesday: emptyDay,
      thursday: emptyDay,
      friday: emptyDay,
      saturday: emptyDay,
      sunday: emptyDay,
      ...days,
    },
  };
}

const routine = makeRoutine({
  thursday: {
    name: 'Tirón + hombro',
    exercises: [
      { name: 'Dominadas', sets: 5, reps: '5' },
      { name: 'Remo con barra', sets: 4, reps: '6' },
      { name: 'Face pull', sets: 3, reps: '15' },
    ],
  },
});

/**
 * Lo que hace cada consumidor, reducido a su esencia: resolver el rango y pedir
 * la sugerencia. La pantalla de entreno solo conoce el nombre del ejercicio; la
 * sesión de rutina además conoce el objetivo del día.
 */
function suggestFor(
  sessions: AutoRegSession[],
  exerciseName: string,
  opts: { explicitTargetReps?: string; bodyweight?: boolean } = {},
): LoadSuggestion | null {
  const { repMin, repMax } = resolveExerciseRepRange(
    exerciseName,
    routine,
    opts.explicitTargetReps,
  );
  const engineOpts = { repMin, repMax, bodyweight: opts.bodyweight };
  return suggestNextLoad(sessions, engineOpts) ?? suggestFromLastSession(sessions, engineOpts);
}

const desdeInicio = (sessions: AutoRegSession[], name: string, bodyweight = false) =>
  suggestFor(sessions, name, { bodyweight });

const desdeRutina = (
  sessions: AutoRegSession[],
  name: string,
  targetReps: string,
  bodyweight = false,
) => suggestFor(sessions, name, { explicitTargetReps: targetReps, bodyweight });

describe('paridad de sugerencia entre pantallas', () => {
  it('Remo con barra: el caso que divergía (80 × 11 vs 82,5)', () => {
    // Historial real del usuario: 80 kg × 6, 6, 6, 10 el 6-ago. Sin RIR ni RPE,
    // así que decide `suggestFromLastSession`.
    const sessions: AutoRegSession[] = [
      {
        date: '2026-08-06T18:00:00Z',
        sets: [
          { weight: 60, reps: 6 },
          { weight: 80, reps: 6 },
          { weight: 80, reps: 6 },
          { weight: 80, reps: 10 },
        ],
      },
    ];

    const inicio = desdeInicio(sessions, 'Remo con barra');
    const rutina = desdeRutina(sessions, 'Remo con barra', '6');

    expect(inicio).toEqual(rutina);
    // Y con el objetivo real (6), la sugerencia es subir carga, no sumar reps.
    expect(inicio?.weight).toBe(82.5);
    expect(inicio?.reps).toBe(6);
    expect(inicio?.action).toBe('increase');
  });

  it('Face pull: mismo peso y mismas reps en ambas pantallas', () => {
    const sessions: AutoRegSession[] = [
      { date: '2026-08-06T18:00:00Z', sets: [{ weight: 42.5, reps: 15 }] },
    ];

    expect(desdeInicio(sessions, 'Face pull')).toEqual(desdeRutina(sessions, 'Face pull', '15'));
  });

  it('con esfuerzo registrado también coinciden', () => {
    const sessions: AutoRegSession[] = [
      { date: '2026-08-01T18:00:00Z', sets: [{ weight: 100, reps: 6, rir: 4 }] },
      { date: '2026-08-06T18:00:00Z', sets: [{ weight: 100, reps: 6, rir: 4 }] },
    ];

    expect(desdeInicio(sessions, 'Remo con barra')).toEqual(
      desdeRutina(sessions, 'Remo con barra', '6'),
    );
  });

  it('peso corporal: coinciden y ninguna sube carga', () => {
    const sessions: AutoRegSession[] = [
      { date: '2026-08-06T18:00:00Z', sets: [{ weight: 102, reps: 6 }] },
    ];

    const inicio = desdeInicio(sessions, 'Dominadas', true);
    const rutina = desdeRutina(sessions, 'Dominadas', '5', true);

    expect(inicio).toEqual(rutina);
    expect(inicio?.weight).toBe(102);
    expect(inicio?.action).toBe('hold');
  });

  it('ejercicio fuera de la rutina: sin objetivo, pero siguen coincidiendo', () => {
    const sessions: AutoRegSession[] = [
      { date: '2026-08-06T18:00:00Z', sets: [{ weight: 35, reps: 10 }] },
    ];

    // La pantalla de entreno no lo encuentra en la rutina; la sesión de rutina
    // tampoco tendría objetivo. Ambas caen al mismo rango indefinido.
    expect(desdeInicio(sessions, 'Curl bíceps barra')).toEqual(
      suggestFor(sessions, 'Curl bíceps barra', { explicitTargetReps: undefined }),
    );
  });

  it('sin historial utilizable ninguna pantalla inventa una sugerencia', () => {
    expect(desdeInicio([], 'Remo con barra')).toBeNull();
    expect(desdeRutina([], 'Remo con barra', '6')).toBeNull();

    const soloCalentamiento: AutoRegSession[] = [
      { date: '2026-08-06T18:00:00Z', sets: [{ weight: 40, reps: 10, is_warmup: true }] },
    ];
    expect(desdeInicio(soloCalentamiento, 'Remo con barra')).toBeNull();
    expect(desdeRutina(soloCalentamiento, 'Remo con barra', '6')).toBeNull();
  });
});
