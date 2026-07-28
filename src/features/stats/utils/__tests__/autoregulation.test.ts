import { describe, it, expect } from 'vitest';
import {
  suggestNextLoad,
  detectStall,
  suggestDeload,
  applyReadiness,
  effectiveRir,
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
});
