import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUIET_HOURS,
  DEFAULT_REMINDER_TIMES,
  formatTime,
  isWithinQuietHours,
  normalizeTime,
  normalizeWeekly,
  toMinutes,
} from '@shared/lib/reminderTimes';

/** Fecha local a una hora concreta de hoy; el silencio se evalúa en local. */
const at = (hour: number, minute = 0): Date => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

describe('normalizeTime', () => {
  it('deja pasar una hora válida', () => {
    expect(normalizeTime({ hour: 7, minute: 5 }, DEFAULT_REMINDER_TIMES.routine)).toEqual({
      hour: 7,
      minute: 5,
    });
  });

  it('acepta los extremos del día', () => {
    expect(normalizeTime({ hour: 0, minute: 0 }, DEFAULT_REMINDER_TIMES.routine)).toEqual({
      hour: 0,
      minute: 0,
    });
    expect(normalizeTime({ hour: 23, minute: 59 }, DEFAULT_REMINDER_TIMES.routine)).toEqual({
      hour: 23,
      minute: 59,
    });
  });

  it('recorta lo que se sale del rango en vez de dejar el aviso sin programar', () => {
    expect(normalizeTime({ hour: 25, minute: 70 }, DEFAULT_REMINDER_TIMES.routine)).toEqual({
      hour: 23,
      minute: 59,
    });
    expect(normalizeTime({ hour: -3, minute: -1 }, DEFAULT_REMINDER_TIMES.routine)).toEqual({
      hour: 0,
      minute: 0,
    });
  });

  it('cae al valor por defecto con datos que no son números', () => {
    expect(normalizeTime(undefined, DEFAULT_REMINDER_TIMES.streak)).toEqual(
      DEFAULT_REMINDER_TIMES.streak,
    );
    expect(normalizeTime({ hour: NaN, minute: Infinity }, DEFAULT_REMINDER_TIMES.streak)).toEqual(
      DEFAULT_REMINDER_TIMES.streak,
    );
  });

  it('trunca decimales: no existe la hora 8.5', () => {
    expect(normalizeTime({ hour: 8.9, minute: 30.7 }, DEFAULT_REMINDER_TIMES.routine)).toEqual({
      hour: 8,
      minute: 30,
    });
  });
});

describe('normalizeWeekly', () => {
  it('mantiene el weekday dentro de la convención de Capacitor (1..7)', () => {
    expect(
      normalizeWeekly({ weekday: 0, hour: 9, minute: 0 }, DEFAULT_REMINDER_TIMES.summary),
    ).toEqual({ weekday: 1, hour: 9, minute: 0 });
    expect(
      normalizeWeekly({ weekday: 9, hour: 9, minute: 0 }, DEFAULT_REMINDER_TIMES.summary),
    ).toEqual({ weekday: 7, hour: 9, minute: 0 });
  });
});

describe('valores por defecto', () => {
  it('coinciden con las constantes que estaban escritas en notifications.ts', () => {
    // Si esto cambia, a quien ya usaba la app le cambia la hora del aviso sin
    // haberlo pedido. El defecto solo debe moverse a propósito.
    expect(DEFAULT_REMINDER_TIMES.routine).toEqual({ hour: 18, minute: 30 });
    expect(DEFAULT_REMINDER_TIMES.streak).toEqual({ hour: 20, minute: 0 });
    expect(DEFAULT_REMINDER_TIMES.summary).toEqual({ weekday: 2, hour: 9, minute: 0 });
  });

  it('el silencio nace apagado', () => {
    expect(DEFAULT_QUIET_HOURS.enabled).toBe(false);
  });
});

describe('isWithinQuietHours', () => {
  const nocturno = { enabled: true, start: { hour: 23, minute: 0 }, end: { hour: 7, minute: 0 } };

  it('apagado no silencia nunca', () => {
    expect(isWithinQuietHours({ ...nocturno, enabled: false }, at(3))).toBe(false);
  });

  it('silencia de madrugada con un rango que cruza la medianoche', () => {
    expect(isWithinQuietHours(nocturno, at(23, 30))).toBe(true);
    expect(isWithinQuietHours(nocturno, at(3))).toBe(true);
    expect(isWithinQuietHours(nocturno, at(6, 59))).toBe(true);
  });

  it('no silencia fuera del rango', () => {
    expect(isWithinQuietHours(nocturno, at(12))).toBe(false);
    expect(isWithinQuietHours(nocturno, at(22, 59))).toBe(false);
  });

  it('el inicio entra y el final no: a las 07:00 ya se puede avisar', () => {
    expect(isWithinQuietHours(nocturno, at(23, 0))).toBe(true);
    expect(isWithinQuietHours(nocturno, at(7, 0))).toBe(false);
  });

  it('un rango normal (sin cruzar medianoche) también funciona', () => {
    const siesta = { enabled: true, start: { hour: 15, minute: 0 }, end: { hour: 17, minute: 0 } };
    expect(isWithinQuietHours(siesta, at(16))).toBe(true);
    expect(isWithinQuietHours(siesta, at(14, 59))).toBe(false);
    expect(isWithinQuietHours(siesta, at(17))).toBe(false);
  });

  it('un rango de ancho cero no silencia las 24 horas', () => {
    // Si silenciara todo el día, el usuario se quedaría sin ningún aviso sin
    // haberlo pedido: es el fallo más caro posible de este cálculo.
    const cero = { enabled: true, start: { hour: 22, minute: 0 }, end: { hour: 22, minute: 0 } };
    expect(isWithinQuietHours(cero, at(22))).toBe(false);
    expect(isWithinQuietHours(cero, at(3))).toBe(false);
  });
});

describe('utilidades', () => {
  it('toMinutes ordena las horas sin construir fechas', () => {
    expect(toMinutes({ hour: 0, minute: 0 })).toBe(0);
    expect(toMinutes({ hour: 18, minute: 30 })).toBe(1110);
  });

  it('formatTime rellena con ceros', () => {
    expect(formatTime({ hour: 9, minute: 5 })).toBe('09:05');
    expect(formatTime({ hour: 23, minute: 59 })).toBe('23:59');
  });
});
