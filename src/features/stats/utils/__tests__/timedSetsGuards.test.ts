/**
 * Las cuatro reglas de `design.md` §4, una por una.
 *
 * Es el riesgo principal de admitir series por tiempo: una plancha que se cuele
 * en un cálculo de fuerza no da un error, da **un número creíble y falso**. Por
 * eso cada regla tiene su test aquí y no repartidos: si alguien vuelve a meter
 * las series sin filtrar en un cálculo de volumen, se cae este fichero y se lee
 * de un vistazo cuál de las cuatro se rompió.
 */
import { describe, it, expect } from 'vitest';
import { onlyRepSets } from '@shared/lib/setShape';
import { calcular1RM } from '@shared/lib/brzycki';
import { calculateSessionVolume } from '../progressionMetrics';
import { calculateMuscleGroupDistribution } from '../statsData';
import { analyzeMuscleRecovery } from '../fatigueAnalysis';
import { suggestFromLastSession } from '../autoregulation';

/** Una serie de fuerza normal. */
const serieDeReps = {
  weight: 100,
  reps: 10,
  duration_seconds: null as number | null,
  is_warmup: false,
  exercise_id: 'ex-press',
  exercise: { name: 'Press banca', muscle_group: 'Pecho' },
  workout: { started_at: '2026-08-25T10:00:00.000Z' },
};

/** Una plancha: sin repeticiones y con duración, tal y como sale de la BD. */
const seriePorTiempo = {
  weight: 0,
  reps: null as number | null,
  duration_seconds: 45,
  is_warmup: false,
  exercise_id: 'ex-plancha',
  exercise: { name: 'Plancha', muscle_group: 'Core' },
  workout: { started_at: '2026-08-25T10:00:00.000Z' },
};

/** Una plancha lastrada: tiene peso, que es justo lo que la hace peligrosa. */
const planchaLastrada = { ...seriePorTiempo, weight: 20 };

describe('regla 1 — el volumen de fuerza ignora las series sin repeticiones', () => {
  it('una plancha no suma volumen, y tampoco lo pone en NaN', () => {
    const mezcla = onlyRepSets([serieDeReps, seriePorTiempo, planchaLastrada]);

    expect(mezcla).toHaveLength(1);
    expect(calculateSessionVolume(mezcla)).toBe(1000);
  });

  it('sin filtrar el daño es peor que un NaN: la plancha cuenta como una serie de cero', () => {
    // El fallo no es ruidoso. `20 * null` en JavaScript **no** es NaN, es 0:
    // `null` se convierte a cero al multiplicar. Así que la suma sobrevive y
    // nada se rompe a la vista — lo que se rompe es todo lo que divide entre el
    // número de series, porque la plancha entra como una serie que hizo cero.
    //
    // Es exactamente lo que `setShape.ts` explica al negarse a usar `?? 0`: un
    // cero es un dato, «no aplica» no lo es.
    const sinFiltrar = [serieDeReps, planchaLastrada] as { weight: number; reps: number }[];

    expect(calculateSessionVolume(sinFiltrar)).toBe(1000);
    expect(calculateSessionVolume(sinFiltrar) / sinFiltrar.length).toBe(500);

    const filtrado = onlyRepSets(sinFiltrar);
    expect(calculateSessionVolume(filtrado) / filtrado.length).toBe(1000);
  });

  it('el reparto por músculo tampoco cuenta lo que no se mide en repeticiones', () => {
    const dist = calculateMuscleGroupDistribution(onlyRepSets([serieDeReps, planchaLastrada]));

    expect(dist).toEqual([{ name: 'Pecho', value: 1000 }]);
  });
});

describe('regla 2 — el 1RM estimado', () => {
  it('calcular1RM devuelve 0 ante reps ausente: no revienta, pero tampoco excluye', () => {
    // Documenta el punto abierto de design.md §4.2. Un cero no rompe una suma,
    // y por eso el fallo sería silencioso: aparecería como «0 kg» en cualquier
    // sitio que lo pintara sin filtrar antes.
    expect(calcular1RM(20, null as unknown as number)).toBe(0);
    expect(calcular1RM(20, 0)).toBe(0);
  });

  it('filtrado antes, una plancha no compite por el mejor 1RM de la sesión', () => {
    const mejor = Math.max(
      ...onlyRepSets([serieDeReps, planchaLastrada]).map((s) => calcular1RM(s.weight, s.reps)),
    );
    expect(Math.round(mejor)).toBe(133);
  });
});

describe('regla 3 — la autorregulación solo mira series de repeticiones', () => {
  const sesion = (fecha: string, sets: unknown[]) => ({
    date: fecha,
    sets: sets as { weight: number; reps: number; rir?: number | null }[],
  });

  it('una plancha no cuenta como serie de trabajo y no dispara ningún consejo', () => {
    // Una sesión que solo tiene planchas no es una sesión de press banca: no
    // puede sugerir nada, y menos una descarga.
    const soloPlanchas = suggestFromLastSession(
      [sesion('2026-08-20T10:00:00.000Z', [seriePorTiempo])],
      {
        repMin: 8,
        repMax: 12,
      },
    );
    expect(soloPlanchas).toBeNull();
  });

  it('con una plancha mezclada, el consejo sale igual que sin ella', () => {
    const soloReps = suggestFromLastSession([sesion('2026-08-20T10:00:00.000Z', [serieDeReps])], {
      repMin: 8,
      repMax: 12,
    });
    const conPlancha = suggestFromLastSession(
      [sesion('2026-08-20T10:00:00.000Z', [serieDeReps, planchaLastrada])],
      { repMin: 8, repMax: 12 },
    );

    expect(conPlancha).toEqual(soloReps);
  });
});

describe('regla 4 — la recuperación muscular SÍ cuenta las series por tiempo', () => {
  it('una sesión de planchas deja el core como recién entrenado', () => {
    // Es la excepción deliberada a las tres reglas anteriores: la recuperación
    // mide **recencia**, no volumen, y una plancha trabaja el core igual que un
    // crunch. Filtrarla dejaba a la app diciendo que el core llevaba días
    // descansando justo después de castigarlo.
    const hoy = new Date().toISOString();
    const estado = analyzeMuscleRecovery([{ ...seriePorTiempo, workout: { started_at: hoy } }]);

    const core = estado.find((m) => m.name === 'Core');
    expect(core).toBeDefined();
    expect(core?.status).toBe('recovering');
  });
});
