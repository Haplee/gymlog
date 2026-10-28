import { describe, it, expect } from 'vitest';
import { toRpcSets } from '../rpcSets';

/** La carga real que manda la app: `rpe` vacío en toda serie de repeticiones. */
const SERIE_REPS = {
  set_num: 1,
  reps: 15,
  weight: 0,
  is_warmup: false,
  notes: '',
  rpe: '',
  set_type: 'normal',
};

describe('toRpcSets', () => {
  // Avería real: el servidor castea `rpe` a numeric al calcular la huella de
  // idempotencia, y `''::numeric` aborta el guardado entero. El campo vacío no
  // puede salir de aquí.
  it('quita el rpe vacío', () => {
    const [serie] = toRpcSets([SERIE_REPS]);

    expect('rpe' in serie).toBe(false);
    expect(serie).toEqual({
      set_num: 1,
      reps: 15,
      weight: 0,
      is_warmup: false,
      notes: '',
      set_type: 'normal',
    });
  });

  it('quita también un rpe que no es un número', () => {
    const [serie] = toRpcSets([{ ...SERIE_REPS, rpe: 'mucho' } as typeof SERIE_REPS]);

    expect('rpe' in serie).toBe(false);
  });

  it('conserva el rpe numérico y el resto de la serie', () => {
    const conRpe = { ...SERIE_REPS, rpe: '8', duration_seconds: 45 };

    expect(toRpcSets([conRpe])).toEqual([conRpe]);
  });

  it('no toca las series que no llevan rpe', () => {
    const serie = { set_num: 1, reps: 5, weight: 80 };
    const sets = [serie];

    // Mismo array: no se crean objetos de más en cada guardado.
    expect(toRpcSets(sets)).toBe(sets);
  });

  it('limpia solo las series que lo necesitan', () => {
    const limpia = { ...SERIE_REPS, rpe: '9' };

    const [primera, segunda] = toRpcSets([SERIE_REPS, limpia]);

    expect('rpe' in primera).toBe(false);
    expect(segunda).toBe(limpia);
  });
});
