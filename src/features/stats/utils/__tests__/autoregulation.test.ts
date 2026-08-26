import { describe, it, expect } from 'vitest';
import {
  suggestNextLoad,
  detectStall,
  suggestDeload,
  applyReadiness,
  suggestFromLastSession,
  effectiveRir,
  buildWeeklyDeloadSamples,
  collectRecentSessionRatings,
  buildDeloadInput,
  MAX_INCREASE_RATIO,
  type AutoRegSession,
  type AutoRegSet,
} from '../autoregulation';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Afirma que el valor no es nulo y lo devuelve estrechado, sin usar `!`. */
function nn<T>(value: T | null | undefined): T {
  expect(value).not.toBeNull();
  return value as T;
}

/** Sesión con `count` series idénticas. */
const session = (date: string, set: AutoRegSet, count = 3): AutoRegSession => ({
  date,
  sets: Array.from({ length: count }, () => ({ ...set })),
});

describe('effectiveRir', () => {
  it('usa el RIR cuando existe', () => {
    expect(effectiveRir({ weight: 100, reps: 5, rir: 3 })).toBe(3);
  });

  it('deriva el RIR del RPE cuando falta', () => {
    expect(effectiveRir({ weight: 100, reps: 5, rpe: 8 })).toBe(2);
    expect(effectiveRir({ weight: 100, reps: 5, rpe: 10 })).toBe(0);
  });

  it('acota al rango 0-5 de la BD', () => {
    expect(effectiveRir({ weight: 100, reps: 5, rpe: 1 })).toBe(5);
    expect(effectiveRir({ weight: 100, reps: 5, rir: 9 })).toBe(5);
    expect(effectiveRir({ weight: 100, reps: 5, rir: -2 })).toBe(0);
  });

  it('devuelve null sin esfuerzo registrado', () => {
    expect(effectiveRir({ weight: 100, reps: 5 })).toBeNull();
    expect(effectiveRir({ weight: 100, reps: 5, rir: null, rpe: null })).toBeNull();
  });
});

describe('suggestNextLoad', () => {
  it('sube la carga cuando sobra margen (RIR muy por encima del objetivo)', () => {
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rir: 4 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 4 }),
    ]);
    expect(s).not.toBeNull();
    expect(nn(s).action).toBe('increase');
    expect(nn(s).weight).toBeGreaterThan(100);
    expect(nn(s).baseWeight).toBe(100);
    expect(nn(s).reasonKey).toBe('coach.reason.margin_left');
  });

  it('nunca sube más de un 10% sobre la carga anterior', () => {
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 20, reps: 10, rir: 5 }),
      session(daysAgo(3), { weight: 20, reps: 10, rir: 5 }),
    ]);
    expect(s).not.toBeNull();
    expect(nn(s).weight).toBeLessThanOrEqual(20 * (1 + MAX_INCREASE_RATIO));
    expect(nn(s).deltaPct).toBeLessThanOrEqual(MAX_INCREASE_RATIO * 100);
  });

  it('progresa por repeticiones cuando ni un escalón cabe bajo el tope', () => {
    // 10 kg: el 10% son 1 kg, menos que el escalón de 2,5 kg.
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 10, reps: 12, rir: 5 }),
      session(daysAgo(3), { weight: 10, reps: 12, rir: 5 }),
    ]);
    expect(s).not.toBeNull();
    expect(nn(s).action).toBe('hold');
    expect(nn(s).weight).toBe(10);
    expect(nn(s).reps).toBe(13);
    expect(nn(s).reasonKey).toBe('coach.reason.add_rep');
  });

  it('baja la carga al llegar al fallo perdiendo repeticiones', () => {
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rpe: 8 }),
      session(daysAgo(3), { weight: 100, reps: 6, rpe: 10 }),
    ]);
    expect(s).not.toBeNull();
    expect(nn(s).action).toBe('reduce');
    expect(nn(s).weight).toBeLessThan(100);
    expect(nn(s).deltaPct).toBeLessThan(0);
    expect(nn(s).reasonKey).toBe('coach.reason.at_failure');
  });

  it('no baja la carga si se apura pero las repeticiones aguantan', () => {
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rpe: 10 }),
      session(daysAgo(3), { weight: 100, reps: 8, rpe: 10 }),
    ]);
    expect(nn(s).action).not.toBe('reduce');
  });

  it('consolida la carga cuando se apura por debajo del objetivo dos sesiones', () => {
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rir: 1 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 1 }),
    ]);
    expect(nn(s).action).toBe('hold');
    expect(nn(s).weight).toBe(100);
    expect(nn(s).reps).toBe(8);
    expect(nn(s).reasonKey).toBe('coach.reason.too_hard');
  });

  it('en rango mantiene carga y suma una repetición', () => {
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 2 }),
    ]);
    expect(nn(s).action).toBe('hold');
    expect(nn(s).weight).toBe(100);
    expect(nn(s).reps).toBe(9);
    expect(nn(s).reasonKey).toBe('coach.reason.on_target');
  });

  it('sube un escalón al alcanzar el techo del rango con esfuerzo registrado', () => {
    const s = suggestNextLoad(
      [
        session(daysAgo(7), { weight: 80, reps: 12, rir: 2 }),
        session(daysAgo(3), { weight: 80, reps: 12, rir: 2 }),
      ],
      { repMin: 8, repMax: 12 },
    );
    expect(nn(s).action).toBe('increase');
    expect(nn(s).weight).toBe(82.5);
    expect(nn(s).reps).toBe(8);
    expect(nn(s).reasonKey).toBe('coach.reason.ceiling');
  });

  it('en el techo del rango y sin subida de margen no se inventa más reps de las debidas', () => {
    // 12 reps, techo 12 y RIR en objetivo: el siguiente paso no es 13 reps.
    const s = suggestNextLoad(
      [
        session(daysAgo(7), { weight: 80, reps: 12, rir: 2 }),
        session(daysAgo(3), { weight: 80, reps: 12, rir: 2 }),
      ],
      { repMin: 8, repMax: 12 },
    );
    expect(nn(s).reps).toBeLessThanOrEqual(12);
  });

  it('en peso corporal, en el techo añade una serie en vez de otra repetición', () => {
    // Este test esperaba 13 repeticiones, y la semana siguiente habría esperado
    // 14: era el «+1 sin fin» que con dominadas acababa en series de treinta.
    // Lo que se protege sigue siendo lo mismo —en peso corporal no se sube la
    // carga—, pero ahora la progresión es por series.
    const s = suggestNextLoad(
      [
        session(daysAgo(7), { weight: 75, reps: 12, rir: 2 }),
        session(daysAgo(3), { weight: 75, reps: 12, rir: 2 }),
      ],
      { repMin: 8, repMax: 12, bodyweight: true },
    );
    expect(nn(s).action).toBe('hold');
    expect(nn(s).weight).toBe(75);
    // El helper `session` monta 3 series, así que la propuesta es la cuarta.
    expect(nn(s).sets).toBe(4);
    expect(nn(s).reps).toBe(8);
    expect(nn(s).reasonKey).toBe('coach.reason.bodyweight_add_set');
  });

  it('al subir por margen en el techo del rango vuelve al suelo de reps', () => {
    const s = suggestNextLoad(
      [
        session(daysAgo(7), { weight: 80, reps: 12, rir: 4 }),
        session(daysAgo(3), { weight: 80, reps: 12, rir: 4 }),
      ],
      { repMin: 8, repMax: 12 },
    );
    expect(nn(s).action).toBe('increase');
    expect(nn(s).reps).toBe(8);
  });

  it('si el escalón supera el tope del 10% en el techo, progresa por reps', () => {
    const s = suggestNextLoad(
      [
        session(daysAgo(7), { weight: 10, reps: 12, rir: 2 }),
        session(daysAgo(3), { weight: 10, reps: 12, rir: 2 }),
      ],
      { repMin: 8, repMax: 12 },
    );
    expect(nn(s).action).toBe('hold');
    expect(nn(s).reps).toBe(13);
  });

  it('ignora el techo del rango si no se indica', () => {
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 80, reps: 12, rir: 2 }),
      session(daysAgo(3), { weight: 80, reps: 12, rir: 2 }),
    ]);
    expect(nn(s).action).toBe('hold');
    expect(nn(s).reps).toBe(13);
    expect(nn(s).reasonKey).toBe('coach.reason.on_target');
  });

  it('respeta un RIR objetivo distinto', () => {
    const sessions = [
      session(daysAgo(7), { weight: 100, reps: 5, rir: 3 }),
      session(daysAgo(3), { weight: 100, reps: 5, rir: 3 }),
    ];
    expect(nn(suggestNextLoad(sessions, { targetRir: 1 })).action).toBe('increase');
    expect(nn(suggestNextLoad(sessions, { targetRir: 3 })).action).toBe('hold');
  });

  it('ignora las series de calentamiento', () => {
    const s = suggestNextLoad([
      { date: daysAgo(7), sets: [{ weight: 100, reps: 8, rir: 2 }] },
      {
        date: daysAgo(3),
        sets: [
          { weight: 40, reps: 15, rir: 5, is_warmup: true },
          { weight: 100, reps: 8, rir: 2 },
        ],
      },
    ]);
    expect(nn(s).baseWeight).toBe(100);
  });

  it('ordena por fecha aunque lleguen desordenadas', () => {
    const ordered = suggestNextLoad([
      session(daysAgo(7), { weight: 90, reps: 8, rir: 4 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 4 }),
    ]);
    const shuffled = suggestNextLoad([
      session(daysAgo(3), { weight: 100, reps: 8, rir: 4 }),
      session(daysAgo(7), { weight: 90, reps: 8, rir: 4 }),
    ]);
    expect(shuffled).toEqual(ordered);
    expect(nn(shuffled).baseWeight).toBe(100);
  });

  it('es determinista', () => {
    const sessions = [
      session(daysAgo(7), { weight: 100, reps: 8, rir: 4 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 4 }),
    ];
    expect(suggestNextLoad(sessions)).toEqual(suggestNextLoad(sessions));
  });

  describe('sin datos suficientes no inventa nada', () => {
    it('con una sola sesión', () => {
      expect(suggestNextLoad([session(daysAgo(3), { weight: 100, reps: 8, rir: 2 })])).toBeNull();
    });

    it('sin sesiones', () => {
      expect(suggestNextLoad([])).toBeNull();
    });

    it('sin RIR ni RPE en la última sesión', () => {
      const s = suggestNextLoad([
        session(daysAgo(7), { weight: 100, reps: 8, rir: 2 }),
        session(daysAgo(3), { weight: 100, reps: 8 }),
      ]);
      expect(s).toBeNull();
    });

    it('con series inválidas (peso o reps a cero)', () => {
      const s = suggestNextLoad([
        session(daysAgo(7), { weight: 0, reps: 8, rir: 2 }),
        session(daysAgo(3), { weight: 100, reps: 0, rir: 2 }),
      ]);
      expect(s).toBeNull();
    });
  });

  it('marca la confianza según cuántas sesiones traen esfuerzo', () => {
    const two = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 2 }),
    ]);
    expect(nn(two).confidence).toBe('medium');

    const four = suggestNextLoad([
      session(daysAgo(14), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(10), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(7), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 2 }),
    ]);
    expect(nn(four).confidence).toBe('high');
  });
});

describe('suggestFromLastSession', () => {
  it('sugiere aunque no haya esfuerzo registrado (una sola sesión)', () => {
    const s = suggestFromLastSession([session(daysAgo(3), { weight: 80, reps: 8 })]);
    expect(nn(s).action).toBe('hold');
    expect(nn(s).weight).toBe(80);
    expect(nn(s).reps).toBe(9);
    expect(nn(s).reasonKey).toBe('coach.reason.no_effort_reps');
    expect(nn(s).confidence).toBe('low');
  });

  it('usa la sesión más reciente aunque lleguen desordenadas', () => {
    const s = suggestFromLastSession([
      session(daysAgo(7), { weight: 70, reps: 8 }),
      session(daysAgo(3), { weight: 90, reps: 8 }),
    ]);
    expect(nn(s).baseWeight).toBe(90);
  });

  it('sube un escalón al alcanzar el techo del rango por defecto (12)', () => {
    const s = suggestFromLastSession([session(daysAgo(3), { weight: 80, reps: 12 })]);
    expect(nn(s).action).toBe('increase');
    expect(nn(s).weight).toBe(82.5);
    expect(nn(s).reps).toBe(8);
    expect(nn(s).reasonKey).toBe('coach.reason.no_effort_increase');
  });

  it('respeta un rango de reps distinto', () => {
    const s = suggestFromLastSession([session(daysAgo(3), { weight: 80, reps: 6 })], {
      repMin: 4,
      repMax: 6,
    });
    expect(nn(s).action).toBe('increase');
    expect(nn(s).reps).toBe(4);
  });

  it('en peso corporal nunca sube carga: en el techo añade serie', () => {
    // Mismo cambio que en `suggestNextLoad`, y este camino importa más: es el
    // que recorre quien registra solo peso y repeticiones, que son la mayoría.
    const s = suggestFromLastSession([session(daysAgo(3), { weight: 75, reps: 12 })], {
      bodyweight: true,
    });
    expect(nn(s).action).toBe('hold');
    expect(nn(s).weight, 'la carga no se toca en peso corporal').toBe(75);
    expect(nn(s).sets, 'el helper monta 3 series: se propone la cuarta').toBe(4);
    expect(nn(s).reasonKey).toBe('coach.reason.bodyweight_add_set');
  });

  it('por debajo del techo sigue sumando repeticiones, como siempre', () => {
    const s = suggestFromLastSession([session(daysAgo(3), { weight: 75, reps: 9 })], {
      repMin: 8,
      repMax: 12,
      bodyweight: true,
    });
    expect(nn(s).reps).toBe(10);
    expect(nn(s).sets).toBeUndefined();
    expect(nn(s).reasonKey).toBe('coach.reason.no_effort_reps');
  });

  it('ignora las series de calentamiento', () => {
    const s = suggestFromLastSession([
      {
        date: daysAgo(3),
        sets: [
          { weight: 40, reps: 15, is_warmup: true },
          { weight: 100, reps: 8 },
        ],
      },
    ]);
    expect(nn(s).baseWeight).toBe(100);
  });

  it('devuelve null sin series de trabajo', () => {
    expect(suggestFromLastSession([])).toBeNull();
    expect(
      suggestFromLastSession([{ date: daysAgo(3), sets: [{ weight: 0, reps: 0 }] }]),
    ).toBeNull();
  });
});

describe('baseReps: el pasado se reporta con datos del pasado', () => {
  it('suggestFromLastSession lleva las reps reales de la serie tope', () => {
    // Caso real: Remo con barra, última sesión 80 kg × 10. La tarjeta mostraba
    // «última · 80 kg × 11» porque reutilizaba las reps sugeridas.
    const s = suggestFromLastSession([
      {
        date: daysAgo(7),
        sets: [
          { weight: 80, reps: 6 },
          { weight: 80, reps: 10 },
        ],
      },
    ]);
    expect(nn(s).baseWeight).toBe(80);
    expect(nn(s).baseReps).toBe(10);
    expect(nn(s).reps).toBe(11);
  });

  it('suggestNextLoad lleva las reps reales de la serie tope', () => {
    const s = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 2 }),
    ]);
    expect(nn(s).baseReps).toBe(8);
  });

  it('applyReadiness conserva el pasado al degradar a mantener', () => {
    const raw = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rir: 4 }),
      session(daysAgo(3), { weight: 100, reps: 8, rir: 4 }),
    ]);
    const held = applyReadiness(raw, { holdLoad: true, reasonKey: 'coach.reason.low_sleep' });
    expect(nn(held).baseReps).toBe(8);
    expect(nn(held).baseWeight).toBe(100);
  });
});

describe('applyReadiness', () => {
  const increase = suggestNextLoad([
    session(daysAgo(7), { weight: 100, reps: 8, rir: 4 }),
    session(daysAgo(3), { weight: 100, reps: 8, rir: 4 }),
  ]);

  it('convierte una subida en mantenimiento con mala recuperación', () => {
    const out = applyReadiness(increase, {
      holdLoad: true,
      reasonKey: 'coach.readiness.low_sleep',
    });
    expect(nn(out).action).toBe('hold');
    expect(nn(out).weight).toBe(100);
    expect(nn(out).deltaPct).toBe(0);
    expect(nn(out).reasonKey).toBe('coach.readiness.low_sleep');
  });

  it('deja la sugerencia intacta sin datos de recuperación', () => {
    expect(applyReadiness(increase, null)).toEqual(increase);
  });

  it('deja la sugerencia intacta con buena recuperación', () => {
    expect(applyReadiness(increase, { holdLoad: false, reasonKey: 'coach.readiness.ok' })).toEqual(
      increase,
    );
  });

  it('no toca una bajada de carga', () => {
    const reduce = suggestNextLoad([
      session(daysAgo(7), { weight: 100, reps: 8, rpe: 8 }),
      session(daysAgo(3), { weight: 100, reps: 6, rpe: 10 }),
    ]);
    expect(applyReadiness(reduce, { holdLoad: true, reasonKey: 'x' })).toEqual(reduce);
  });

  it('propaga null', () => {
    expect(applyReadiness(null, { holdLoad: true, reasonKey: 'x' })).toBeNull();
  });
});

describe('detectStall', () => {
  it('detecta estancamiento tras 3 sesiones sin mejorar el e1RM', () => {
    const r = detectStall([
      session(daysAgo(20), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(15), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(10), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(5), { weight: 100, reps: 8, rir: 2 }),
    ]);
    expect(nn(r).stalled).toBe(true);
    expect(nn(r).sessionsSinceBest).toBe(3);
  });

  it('no marca estancamiento si el e1RM sigue subiendo', () => {
    const r = detectStall([
      session(daysAgo(20), { weight: 90, reps: 8, rir: 2 }),
      session(daysAgo(15), { weight: 95, reps: 8, rir: 2 }),
      session(daysAgo(10), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(5), { weight: 105, reps: 8, rir: 2 }),
    ]);
    expect(nn(r).stalled).toBe(false);
  });

  it('marca estancamiento por tiempo aunque haya pocas sesiones', () => {
    const r = detectStall([
      session(daysAgo(60), { weight: 100, reps: 8, rir: 2 }),
      session(daysAgo(40), { weight: 98, reps: 8, rir: 2 }),
      session(daysAgo(5), { weight: 99, reps: 8, rir: 2 }),
    ]);
    expect(nn(r).stalled).toBe(true);
    expect(nn(r).daysSinceBest).toBeGreaterThanOrEqual(21);
  });

  it('atribuye a fatiga cuando se entrena siempre al límite', () => {
    const r = detectStall([
      session(daysAgo(20), { weight: 100, reps: 8, rir: 0 }),
      session(daysAgo(15), { weight: 100, reps: 8, rir: 0 }),
      session(daysAgo(10), { weight: 100, reps: 8, rir: 1 }),
      session(daysAgo(5), { weight: 100, reps: 8, rir: 0 }),
    ]);
    expect(nn(r).causeKey).toBe('fatigue');
  });

  it('atribuye a frecuencia cuando las sesiones están muy separadas', () => {
    const r = detectStall([
      session(daysAgo(75), { weight: 100, reps: 8, rir: 3 }),
      session(daysAgo(50), { weight: 100, reps: 8, rir: 3 }),
      session(daysAgo(25), { weight: 100, reps: 8, rir: 3 }),
      session(daysAgo(2), { weight: 100, reps: 8, rir: 3 }),
    ]);
    expect(nn(r).causeKey).toBe('frequency');
  });

  it('atribuye a volumen cuando se hacen muy pocas series', () => {
    const r = detectStall([
      session(daysAgo(20), { weight: 100, reps: 8, rir: 3 }, 1),
      session(daysAgo(15), { weight: 100, reps: 8, rir: 3 }, 1),
      session(daysAgo(10), { weight: 100, reps: 8, rir: 3 }, 1),
      session(daysAgo(5), { weight: 100, reps: 8, rir: 3 }, 1),
    ]);
    expect(nn(r).causeKey).toBe('volume');
  });

  it('devuelve null con menos de tres sesiones', () => {
    expect(detectStall([session(daysAgo(5), { weight: 100, reps: 8, rir: 2 })])).toBeNull();
    expect(
      detectStall([
        session(daysAgo(10), { weight: 100, reps: 8, rir: 2 }),
        session(daysAgo(5), { weight: 100, reps: 8, rir: 2 }),
      ]),
    ).toBeNull();
  });
});

describe('suggestDeload', () => {
  it('recomienda descarga con volumen subiendo, RIR cayendo y sesiones mal valoradas', () => {
    const r = suggestDeload({
      weeklyVolumes: [10_000, 12_000, 14_000, 16_000],
      weeklyRir: [3, 2, 1],
      sessionRatings: [2, 2, 3],
    });
    expect(nn(r).recommended).toBe(true);
    expect(nn(r).risingWeeks).toBe(3);
    expect(nn(r).reasonKey).toBe('coach.reason.deload');
  });

  it('no recomienda descarga si el volumen no lleva subiendo tres semanas', () => {
    const r = suggestDeload({
      weeklyVolumes: [10_000, 14_000, 12_000, 16_000],
      weeklyRir: [3, 2, 1],
      sessionRatings: [2, 2, 2],
    });
    expect(nn(r).recommended).toBe(false);
  });

  it('no recomienda descarga si el RIR no cae', () => {
    const r = suggestDeload({
      weeklyVolumes: [10_000, 12_000, 14_000, 16_000],
      weeklyRir: [2, 2, 3],
      sessionRatings: [2, 2, 2],
    });
    expect(nn(r).recommended).toBe(false);
  });

  it('no recomienda descarga si las sesiones se valoran bien', () => {
    const r = suggestDeload({
      weeklyVolumes: [10_000, 12_000, 14_000, 16_000],
      weeklyRir: [3, 2, 1],
      sessionRatings: [5, 4, 5],
    });
    expect(nn(r).recommended).toBe(false);
  });

  it('sin valoraciones no exige esa señal', () => {
    const r = suggestDeload({
      weeklyVolumes: [10_000, 12_000, 14_000, 16_000],
      weeklyRir: [3, 2, 1],
    });
    expect(nn(r).recommended).toBe(true);
  });

  it('devuelve null sin tres semanas de datos', () => {
    expect(suggestDeload({ weeklyVolumes: [10_000, 12_000], weeklyRir: [3, 2] })).toBeNull();
  });

  it('con semanas sin esfuerzo registrado no confirma la caída del RIR', () => {
    const r = suggestDeload({
      weeklyVolumes: [10_000, 12_000, 14_000, 16_000],
      weeklyRir: [null, 2, null],
    });
    expect(nn(r).recommended).toBe(false);
  });

  it('sí confirma la caída del RIR si hay suficientes valores no nulos', () => {
    const r = suggestDeload({
      weeklyVolumes: [10_000, 12_000, 14_000, 16_000],
      weeklyRir: [null, 3, 1],
    });
    expect(nn(r).recommended).toBe(true);
  });
});

describe('buildWeeklyDeloadSamples', () => {
  const wo = (started_at: string | null, sets: AutoRegSet[], rating?: number | null) => ({
    started_at,
    rating,
    sets,
  });

  it('agrupa por semana ISO (lunes) y suma el volumen de series de trabajo', () => {
    const samples = buildWeeklyDeloadSamples([
      wo('2026-06-16T10:00:00Z', [{ weight: 100, reps: 8, rir: 2 }]),
      wo('2026-06-24T10:00:00Z', [
        { weight: 80, reps: 10, rir: 3 },
        { weight: 90, reps: 8, rpe: 8 }, // rir derivado → 2
        { weight: 50, reps: 10, is_warmup: true }, // excluida
      ]),
    ]);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({ weekStart: '2026-06-15', volume: 800, rir: 2 });
    expect(samples[1]).toEqual({ weekStart: '2026-06-22', volume: 1520, rir: 2.5 });
  });

  it('reporta rir null cuando ninguna serie registra esfuerzo', () => {
    const samples = buildWeeklyDeloadSamples([
      wo('2026-06-16T10:00:00Z', [{ weight: 100, reps: 8 }]),
    ]);
    expect(samples).toHaveLength(1);
    expect(samples[0].rir).toBeNull();
    expect(samples[0].volume).toBe(800);
  });

  it('ignora entrenos sin fecha y semanas solo con calentamiento', () => {
    const samples = buildWeeklyDeloadSamples([
      wo(null, [{ weight: 100, reps: 8 }]),
      wo('2026-06-16T10:00:00Z', [{ weight: 100, reps: 8, is_warmup: true }]),
    ]);
    expect(samples).toHaveLength(0);
  });
});

describe('collectRecentSessionRatings', () => {
  it('toma las valoraciones recientes (1–5) de más nueva a más antigua', () => {
    const ratings = collectRecentSessionRatings([
      { started_at: '2026-06-20T10:00:00Z', rating: 2, sets: [] },
      { started_at: '2026-06-26T10:00:00Z', rating: null, sets: [] },
      { started_at: '2026-06-24T10:00:00Z', rating: 5, sets: [] },
      { started_at: null, rating: 3, sets: [] },
    ]);
    expect(ratings).toEqual([5, 2, 3]);
  });
});

describe('buildDeloadInput', () => {
  it('produce volumen y RIR por semana más las valoraciones', () => {
    const input = nn(
      buildDeloadInput([
        { started_at: '2026-06-16T10:00:00Z', rating: 2, sets: [{ weight: 100, reps: 8, rir: 2 }] },
        { started_at: '2026-06-24T10:00:00Z', rating: 5, sets: [{ weight: 80, reps: 10, rir: 3 }] },
      ]),
    );
    expect(input.weeklyVolumes).toEqual([800, 800]);
    expect(input.weeklyRir).toEqual([2, 3]);
    expect(input.sessionRatings).toEqual([5, 2]);
  });

  it('devuelve null sin datos', () => {
    expect(buildDeloadInput([])).toBeNull();
  });
});
