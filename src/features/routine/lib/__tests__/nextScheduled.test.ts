import { describe, it, expect } from 'vitest';
import type { Routine } from '@features/routine/stores/routineStore';
import { computeNextScheduled } from '../nextScheduled';

function routine(id: string, name: string): Routine {
  return { id, name } as unknown as Routine;
}

const HOY = '2026-03-10';

describe('computeNextScheduled', () => {
  it('devuelve el cambio futuro más cercano', () => {
    const next = computeNextScheduled(
      { r1: '2026-04-01', r2: '2026-03-20' },
      'r3',
      [routine('r1', 'Full body'), routine('r2', 'Torso pierna')],
      HOY,
    );
    expect(next).toEqual({ name: 'Torso pierna', date: '2026-03-20' });
  });

  it('ignora la rutina que ya está activa', () => {
    const next = computeNextScheduled(
      { r1: '2026-03-12', r2: '2026-03-20' },
      'r1',
      [routine('r1', 'Full body'), routine('r2', 'Torso pierna')],
      HOY,
    );
    // r1 es la activa: avisar de que «va a entrar» no diría nada.
    expect(next).toEqual({ name: 'Torso pierna', date: '2026-03-20' });
  });

  it('ignora las fechas de hoy y las ya pasadas', () => {
    expect(computeNextScheduled({ r1: HOY }, null, [routine('r1', 'Hoy')], HOY)).toBeNull();
    expect(
      computeNextScheduled({ r1: '2026-03-09' }, null, [routine('r1', 'Ayer')], HOY),
    ).toBeNull();
  });

  it('sin calendario no hay aviso', () => {
    expect(computeNextScheduled({}, null, [], HOY)).toBeNull();
  });

  it('una rutina programada que ya no existe no genera un nombre vacío', () => {
    expect(computeNextScheduled({ borrada: '2026-03-20' }, null, [], HOY)).toBeNull();
  });

  it('dos rutinas el mismo día: devuelve la primera del objeto, sin reventar', () => {
    // El orden de las claves decide el empate (no hay desempate por id aquí).
    // Se fija el comportamiento actual para que un cambio se note.
    const next = computeNextScheduled(
      { r2: '2026-03-20', r1: '2026-03-20' },
      null,
      [routine('r1', 'Uno'), routine('r2', 'Dos')],
      HOY,
    );
    expect(next).toEqual({ name: 'Dos', date: '2026-03-20' });
  });
});
