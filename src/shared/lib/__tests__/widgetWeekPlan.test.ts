import { describe, it, expect } from 'vitest';
import { buildWeekPlan } from '@shared/lib/widget';

/* El widget elige la casilla de hoy con `Calendar.DAY_OF_WEEK - 1`, así que un
   desplazamiento de una posición aquí le hace mostrar la rutina del día
   equivocado — y sin fallar por ningún lado. */
describe('buildWeekPlan', () => {
  it('coloca cada rutina en la casilla de su weekday (1=domingo … 7=sábado)', () => {
    const plan = buildWeekPlan([
      { weekday: 2, routineName: 'Push' },
      { weekday: 5, routineName: 'Pull' },
    ]);

    expect(plan).toHaveLength(7);
    expect(plan[1]).toBe('Push'); // lunes
    expect(plan[4]).toBe('Pull'); // jueves
  });

  it('deja en blanco los días de descanso', () => {
    const plan = buildWeekPlan([{ weekday: 2, routineName: 'Push' }]);
    expect(plan.filter((d) => d === '')).toHaveLength(6);
  });

  it('sin rutina devuelve una semana vacía, no undefined', () => {
    expect(buildWeekPlan([])).toEqual(['', '', '', '', '', '', '']);
  });

  it('el domingo va en la primera casilla y el sábado en la última', () => {
    const plan = buildWeekPlan([
      { weekday: 1, routineName: 'Domingo' },
      { weekday: 7, routineName: 'Sábado' },
    ]);
    expect(plan[0]).toBe('Domingo');
    expect(plan[6]).toBe('Sábado');
  });

  it('ignora un weekday fuera de rango en vez de desplazar la semana', () => {
    const plan = buildWeekPlan([
      { weekday: 0, routineName: 'Inválido' },
      { weekday: 8, routineName: 'Inválido' },
      { weekday: 3, routineName: 'Válido' },
    ]);
    expect(plan[2]).toBe('Válido');
    expect(plan).not.toContain('Inválido');
    expect(plan).toHaveLength(7);
  });
});
