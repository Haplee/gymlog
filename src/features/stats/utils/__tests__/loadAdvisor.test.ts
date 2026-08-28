/**
 * Cadena completa de decisión de carga.
 *
 * Estos son los casos que motivaron el cambio: el motor recomendaba subir el
 * peso semana tras semana mirando solo la serie más pesada, sin preguntarse si
 * la sesión se había completado, cuánto trabajo llevaba el músculo o si el
 * ejercicio llevaba un mes sin mejorar.
 */

import { describe, it, expect } from 'vitest';
import { buildLoadAdvice } from '../loadAdvisor';
import { buildVolumeContext, type VolumeSet } from '../trainingLoad';
import type { AutoRegSession, AutoRegSet } from '../autoregulation';

/** Sesión de varias series al mismo peso, con las reps que se indiquen. */
function sesion(date: string, weight: number, reps: number[], rir?: number): AutoRegSession {
  const sets: AutoRegSet[] = reps.map((r) => ({ weight, reps: r, rir: rir ?? null }));
  return { date: `${date}T10:00:00.000Z`, sets };
}

const RANGO = { repMin: 8, repMax: 10 };
/** Desenvuelve un resultado que el test da por hecho que existe. */
function exigir<T>(value: T | null | undefined, que = 'el resultado'): T {
  if (value === null || value === undefined) throw new Error(`${que} no debería faltar`);
  return value;
}

describe('completar el esquema antes de subir', () => {
  it('con solo la primera serie en el techo NO sube: consolida', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [sesion('2026-08-14', 100, [10, 8, 7]), sesion('2026-08-21', 100, [10, 8, 7])],
        ...RANGO,
      }),
    );

    expect(advice.suggestion.action).toBe('hold');
    expect(advice.suggestion.weight).toBe(100);
    expect(advice.suggestion.reasonKey).toBe('coach.reason.finish_the_sets');
  });

  it('con todas las series en el techo sí sube un escalón', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [
          sesion('2026-08-14', 100, [10, 10, 10]),
          sesion('2026-08-21', 100, [10, 10, 10]),
        ],
        ...RANGO,
      }),
    );

    expect(advice.suggestion.action).toBe('increase');
    expect(advice.suggestion.weight).toBe(102.5);
  });

  it('la regla aplica también con esfuerzo registrado, no solo en el fallback', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [
          sesion('2026-08-14', 100, [10, 9, 8], 2),
          sesion('2026-08-21', 100, [10, 9, 8], 2),
        ],
        ...RANGO,
      }),
    );

    expect(advice.suggestion.action).toBe('hold');
    expect(advice.suggestion.reasonKey).toBe('coach.reason.finish_the_sets');
  });

  it('una sola serie registrada se comporta como antes: no penaliza a quien anota poco', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [sesion('2026-08-14', 100, [10]), sesion('2026-08-21', 100, [10])],
        ...RANGO,
      }),
    );

    expect(advice.suggestion.action).toBe('increase');
  });
});

describe('topes de ritmo', () => {
  it('no encadena dos subidas en la misma semana', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [
          sesion('2026-08-10', 100, [10, 10, 10]),
          sesion('2026-08-17', 100, [10, 10, 10]),
          sesion('2026-08-20', 106, [10, 10, 10]),
        ],
        ...RANGO,
      }),
    );

    expect(advice.suggestion.action).toBe('hold');
    expect(advice.suggestion.reasonKey).toBe('coach.reason.weekly_cap');
  });

  it('tras un mes sin tocar el ejercicio repite peso en vez de subir', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [
          sesion('2026-07-01', 100, [10, 10, 10]),
          sesion('2026-08-21', 100, [10, 10, 10]),
        ],
        ...RANGO,
      }),
    );

    expect(advice.suggestion.action).toBe('hold');
    expect(advice.suggestion.reasonKey).toBe('coach.reason.stale_data');
  });

  it('en una sala sin discos pequeños progresa por repeticiones, no por carga', () => {
    // Un escalón de 10 kg sobre 60 kg es un +16 %: no cabe bajo el tope del 10 %.
    const advice = exigir(
      buildLoadAdvice({
        sessions: [sesion('2026-08-14', 60, [10, 10, 10]), sesion('2026-08-21', 60, [10, 10, 10])],
        ...RANGO,
        stepKg: 10,
      }),
    );

    expect(advice.suggestion.action).toBe('hold');
    expect(advice.suggestion.weight).toBe(60);
    expect(advice.suggestion.reps).toBe(11);
  });

  it('con micro-discos el mismo caso sí progresa por carga', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [sesion('2026-08-14', 60, [10, 10, 10]), sesion('2026-08-21', 60, [10, 10, 10])],
        ...RANGO,
        stepKg: 1,
      }),
    );

    expect(advice.suggestion.action).toBe('increase');
    expect(advice.suggestion.weight).toBe(61);
  });
});

describe('estancamiento: dejar de insistir', () => {
  const cada3dias = ['2026-08-05', '2026-08-08', '2026-08-11', '2026-08-14'];

  it('sin mejorar en tres sesiones no se sube el peso', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: cada3dias.map((d) => sesion(d, 100, [10, 10, 10])),
        ...RANGO,
      }),
    );

    expect(advice.stall?.stalled).toBe(true);
    expect(advice.suggestion.action).toBe('hold');
    expect(advice.suggestion.reasonKey).toBe('coach.reason.stall_hold');
  });

  it('si el estancamiento se alarga, se retrocede un 10 % para coger carrerilla', () => {
    const fechas = [...cada3dias, '2026-08-17', '2026-08-20'];
    const advice = exigir(
      buildLoadAdvice({
        sessions: fechas.map((d) => sesion(d, 100, [10, 10, 10])),
        ...RANGO,
      }),
    );

    expect(advice.suggestion.action).toBe('reduce');
    expect(advice.suggestion.weight).toBe(90);
    expect(advice.suggestion.reasonKey).toBe('coach.reason.stall_reset');
  });
});

describe('el volumen semanal manda sobre la subida', () => {
  const AHORA = new Date('2026-08-21T12:00:00.000Z');
  const DIA = 86_400_000;

  function seriesDe(muscle: string, daysAgo: number, count: number): VolumeSet[] {
    const date = new Date(AHORA.getTime() - daysAgo * DIA).toISOString();
    return Array.from({ length: count }, () => ({ date, muscleGroup: muscle }));
  }

  const sesionesQueSuben = [
    sesion('2026-08-14', 100, [10, 10, 10]),
    sesion('2026-08-21', 100, [10, 10, 10]),
  ];

  it('una semana disparada convierte la subida en mantenimiento', () => {
    const volume = buildVolumeContext(
      [
        ...seriesDe('pierna', 1, 20),
        ...seriesDe('pierna', 9, 8),
        ...seriesDe('pierna', 16, 8),
        ...seriesDe('pierna', 23, 8),
      ],
      'pierna',
      AHORA,
    );

    const advice = exigir(buildLoadAdvice({ sessions: sesionesQueSuben, ...RANGO, volume }));

    expect(advice.suggestion.action).toBe('hold');
    expect(advice.suggestion.reasonKey).toBe('coach.reason.volume_spike');
  });

  it('con el volumen en su sitio, la misma sesión sí sube', () => {
    const volume = buildVolumeContext(
      [
        ...seriesDe('pierna', 1, 10),
        ...seriesDe('pierna', 9, 10),
        ...seriesDe('pierna', 16, 10),
        ...seriesDe('pierna', 23, 10),
      ],
      'pierna',
      AHORA,
    );

    const advice = exigir(buildLoadAdvice({ sessions: sesionesQueSuben, ...RANGO, volume }));

    expect(advice.suggestion.action).toBe('increase');
  });

  it('la recuperación del wearable sigue aplazando la subida', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: sesionesQueSuben,
        ...RANGO,
        readiness: { holdLoad: true, reasonKey: 'coach.readiness.low_sleep' },
      }),
    );

    expect(advice.suggestion.action).toBe('hold');
    expect(advice.suggestion.reasonKey).toBe('coach.readiness.low_sleep');
  });

  it('sin historial no inventa nada', () => {
    expect(buildLoadAdvice({ sessions: [], ...RANGO })).toBeNull();
  });
});

/* ------------------------------------------------------ por lado (f4) ------ */

describe('objetivo de un ejercicio por lado', () => {
  it('sube de dos en dos: 16 → 18, no 17', () => {
    // Una zancada a 16 repeticiones totales son 8 por pierna. Sumar 1 daría 17,
    // es decir 9 en una pierna y 8 en la otra: no es un objetivo que nadie se
    // plantee.
    const advice = exigir(
      buildLoadAdvice({
        sessions: [sesion('2026-08-14', 20, [16, 16, 16]), sesion('2026-08-21', 20, [16, 16, 16])],
        repMin: 16,
        repMax: 24,
        perSide: true,
      }),
    );

    expect(advice.suggestion.reps).toBe(18);
  });

  it('sin la bandera el mismo caso sube de uno en uno', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [sesion('2026-08-14', 20, [16, 16, 16]), sesion('2026-08-21', 20, [16, 16, 16])],
        repMin: 16,
        repMax: 24,
      }),
    );

    expect(advice.suggestion.reps).toBe(17);
  });

  it('nunca propone un objetivo impar, se venga de donde se venga', () => {
    // Recorre todos los puntos de partida del rango, incluidos los impares que
    // pudo dejar una versión anterior de la app.
    for (let desde = 12; desde <= 23; desde++) {
      const advice = buildLoadAdvice({
        sessions: [
          sesion('2026-08-14', 20, [desde, desde, desde]),
          sesion('2026-08-21', 20, [desde, desde, desde]),
        ],
        repMin: 16,
        repMax: 24,
        perSide: true,
      });
      if (!advice) continue;
      expect(advice.suggestion.reps % 2, `partiendo de ${desde}`).toBe(0);
    }
  });

  it('también respeta el paso por el camino de la última sesión sin esfuerzo', () => {
    // `suggestNextLoad` se niega a decidir sin RIR/RPE y cae en
    // `suggestFromLastSession`. Es el camino que recorre la mayoría de usuarios,
    // que registra solo peso y reps, así que el paso tiene que valer ahí también.
    const advice = exigir(
      buildLoadAdvice({
        sessions: [sesion('2026-08-21', 20, [16, 16, 16])],
        repMin: 16,
        repMax: 24,
        perSide: true,
      }),
    );

    expect(advice.suggestion.reps).toBe(18);
  });
});

/* --------------------------------------- peso corporal: el techo (f2.5) ---- */

describe('progresión en peso corporal', () => {
  /** Sesión de N series de dominadas al peso corporal (sin lastre). */
  const calistenia = (fecha: string, reps: number[], rir?: number): AutoRegSession => ({
    date: `${fecha}T10:00:00.000Z`,
    sets: reps.map((r) => ({ weight: 0, reps: r, rir: rir ?? null })),
  });

  // El peso corporal se registra con el peso real de la persona, no con 0: es lo
  // que hace el store para que volumen y PRs salgan bien. Se usa 80 kg.
  const conPeso = (fecha: string, reps: number[], rir?: number): AutoRegSession => ({
    date: `${fecha}T10:00:00.000Z`,
    sets: reps.map((r) => ({ weight: 80, reps: r, rir: rir ?? null })),
  });

  it('por debajo del techo sigue sumando repeticiones', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [conPeso('2026-08-14', [8, 8, 8]), conPeso('2026-08-21', [8, 8, 8])],
        repMin: 8,
        repMax: 12,
        bodyweight: true,
      }),
    );

    expect(advice.suggestion.reps).toBe(9);
    expect(advice.suggestion.sets).toBeUndefined();
  });

  it('EN el techo ya no suma otra repetición: añade una serie', () => {
    // Esto es lo que estaba mal. Antes proponía 13 repeticiones, y a la semana
    // siguiente 14, sin fin: con dominadas acababa recomendando series de treinta,
    // que ya no entrenan fuerza.
    const advice = exigir(
      buildLoadAdvice({
        sessions: [conPeso('2026-08-14', [12, 12, 12]), conPeso('2026-08-21', [12, 12, 12])],
        repMin: 8,
        repMax: 12,
        bodyweight: true,
      }),
    );

    expect(advice.suggestion.sets, 'tiene que proponer una serie más').toBe(4);
    expect(advice.suggestion.reps, 'y volver al suelo del rango').toBe(8);
    expect(advice.suggestion.reasonKey).toBe('coach.reason.bodyweight_add_set');
    // No sube carga: en peso corporal no hay carga que subir.
    expect(advice.suggestion.action).toBe('hold');
  });

  it('con 5 series ya hechas propone lastrar, no una sexta', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [
          conPeso('2026-08-14', [12, 12, 12, 12, 12]),
          conPeso('2026-08-21', [12, 12, 12, 12, 12]),
        ],
        repMin: 8,
        repMax: 12,
        bodyweight: true,
        stepKg: 2.5,
      }),
    );

    expect(advice.suggestion.reasonKey).toBe('coach.reason.bodyweight_add_load');
    expect(advice.suggestion.action).toBe('increase');
    // El lastre empieza por el disco más pequeño que el usuario puede montar.
    expect(advice.suggestion.weight).toBe(82.5);
    expect(advice.suggestion.sets).toBeUndefined();
  });

  it('nunca propone más de 5 series', () => {
    for (const n of [3, 4, 5, 6, 7]) {
      const advice = buildLoadAdvice({
        sessions: [
          conPeso('2026-08-14', Array(n).fill(12)),
          conPeso('2026-08-21', Array(n).fill(12)),
        ],
        repMin: 8,
        repMax: 12,
        bodyweight: true,
      });
      const sets = advice?.suggestion.sets;
      if (sets != null) expect(sets, `partiendo de ${n} series`).toBeLessThanOrEqual(5);
    }
  });

  it('una serie con peso 0 no es serie de trabajo: no llega al motor', () => {
    // Sale de intentar probar la división por cero de `deltaPct` y descubrir que
    // no puede darse: `isWorkingSet` exige `weight > 0`. En peso corporal el
    // store guarda el peso real de la persona, no un cero, justo para que
    // volumen y récords salgan bien. Queda escrito para que nadie vuelva a
    // «arreglar» un caso que no existe.
    expect(
      buildLoadAdvice({
        sessions: [calistenia('2026-08-14', [12, 12, 12]), calistenia('2026-08-21', [12, 12, 12])],
        repMin: 8,
        repMax: 12,
        bodyweight: true,
      }),
    ).toBeNull();
  });

  it('un ejercicio con carga no se ve afectado: sigue subiendo peso', () => {
    const advice = exigir(
      buildLoadAdvice({
        sessions: [
          sesion('2026-08-14', 100, [10, 10, 10]),
          sesion('2026-08-21', 100, [10, 10, 10]),
        ],
        repMin: 8,
        repMax: 10,
      }),
    );

    expect(advice.suggestion.action).toBe('increase');
    expect(advice.suggestion.sets).toBeUndefined();
  });
});
