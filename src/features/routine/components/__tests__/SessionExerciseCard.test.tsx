// @vitest-environment jsdom
//
// La tarjeta de rutina pasó a ser el plan del día: el peso recomendado se lee,
// no se teclea. El riesgo de ese cambio no es que se vea feo, es que se rompa
// el bucle que la hizo editable en su momento.
//
// Cuando la tarjeta era solo informativa, escribía la recomendación de la app
// en las series y la guardaba como si fuera el entrenamiento. El motor se
// alimentaba de sus propias sugerencias, así que todas las series salían en el
// techo del rango, el e1RM subía solo y el estancamiento no se detectaba nunca.
//
// Cerrar ese bucle no es quitar la edición: es que la recomendación se lea y la
// corrección se escriba. Estos tests fijan las dos mitades —el plan se ve sin
// tocar nada, y corregir una serie marca `weightTouched` para que la
// recomendación no la vuelva a pisar— porque si mañana alguien quita el toque
// para simplificar la tarjeta, el fallo reaparece en silencio y no lo detecta
// ni el linter ni los tipos.
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { SessionExerciseCard } from '../SessionExerciseCard';

// `t` resuelve contra las traducciones reales, no contra un diccionario de
// mentira: la tarjeta ya no enseña el plan como una fila por serie, sino como
// una frase con números dentro. Un mock que devolviera la clave comprobaría que
// la clave se pinta, que es justo lo que no importa.
import { resources } from '@shared/lib/i18n/resources';

const ES = resources.es.translation as unknown as Record<string, unknown>;

function t(k: string, params?: Record<string, string | number>): string {
  const valor = k
    .split('.')
    .reduce<unknown>((nodo, parte) => (nodo as Record<string, unknown> | undefined)?.[parte], ES);
  const texto = typeof valor === 'string' ? valor : k;
  return Object.entries(params ?? {}).reduce(
    (t2, [clave, valor2]) => t2.replaceAll(`{{${clave}}}`, String(valor2)),
    texto,
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string | number>) => t(k, p),
    i18n: { language: 'es' },
  }),
}));

const updateSet = vi.fn();
const addSet = vi.fn();
const removeSet = vi.fn();
const setExerciseRpe = vi.fn();

vi.mock('../../stores/routineSessionStore', () => ({
  useRoutineSessionStore: (selector: (s: unknown) => unknown) =>
    selector({ updateSet, addSet, removeSet, setExerciseRpe }),
}));

vi.mock('@features/stats/hooks/useExerciseAdvice', () => ({
  useExerciseAdvice: () => ({
    exercise: 'Press banca',
    suggestion: {
      weight: 82.5,
      baseWeight: 80,
      baseReps: 8,
      reps: 8,
      action: 'increase',
      reasonKey: 'coach.reason_progressive_overload',
      confidence: 'high',
      // Dos escalones: 40 % a la baja y 80 % a la baja, con el redondeo al
      // escalón hecho por el motor. La rampa que la tarjeta pinta es esta.
      warmup: [
        { weight: 32.5, reps: 8 },
        { weight: 65, reps: 5 },
      ],
    },
    stall: null,
  }),
}));

vi.mock('@shared/hooks/useExerciseRepRange', () => ({
  useExerciseRepRange: () => ({ repMin: 8, repMax: 12 }),
}));

vi.mock('@features/workout/components/WorkTimer', () => ({
  WorkTimer: () => <div data-testid="work-timer" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  return render(
    <SessionExerciseCard
      userId="user-1"
      exerciseIndex={0}
      exercise={{
        name: 'Press banca',
        targetSets: 3,
        targetReps: '8',
        mode: 'reps',
        perSide: false,
        sets: [
          { id: 'a', reps: '8', weight: '82.5', durationSeconds: '', rpe: '' },
          { id: 'b', reps: '8', weight: '82.5', durationSeconds: '', rpe: '' },
        ],
      }}
      weightUnit="kg"
      onAdvice={vi.fn()}
    />,
  );
}

describe('SessionExerciseCard', () => {
  it('cuenta el plan en una frase y no en una fila por serie', () => {
    setup();

    // El peso recomendado sigue siendo el dato protagonista...
    expect(screen.getAllByText(/82\.5 kg/).length).toBeGreaterThan(0);
    // ...y con él el motivo, que es lo que decide si el plan se sigue a ciegas.
    expect(screen.getAllByText(/progres|sobrecarga|sube|semana/i).length).toBeGreaterThan(0);
    // La frase del plan lleva los números dentro. Dos series en el fixture, ocho
    // reps y el peso del motor: de ahí sale «2 × 8 a 82.5 kg» sin tocar nada.
    expect(screen.getByText(/Vas a hacer 2 × 8 a 82\.5 kg\./)).toBeInTheDocument();
  });

  it('dibuja la escalera a escala, no como una lista de pesos', () => {
    const { container } = setup();

    // Los dos calentamientos del motor más el peso de trabajo: tres peldaños.
    const barras = container.querySelectorAll('[aria-hidden="true"] > span[style]');
    expect(barras).toHaveLength(3);

    // El punto de este bloque es que el ancho *significa* algo. Si el ancho
    // dejara de ser proporcional al peso, el gráfico pasaría a ser adorno, y
    // una escalera de calentamiento es justo lo que no puede ser eso.
    const anchos = [...barras].map((b) => parseFloat((b as HTMLElement).style.width));
    expect(anchos[0]).toBeLessThan(anchos[1]);
    expect(anchos[1]).toBeLessThan(anchos[2]);
    // Y el último peldaño es el peso completo: la barra llega al final.
    expect(anchos[2]).toBeCloseTo(100);

    // 32,5 y 65 sobre 82,5, los dos pesos que propuso el motor.
    expect(anchos[0]).toBeCloseTo((32.5 / 82.5) * 100, 1);
    expect(anchos[1]).toBeCloseTo((65 / 82.5) * 100, 1);
  });

  it('dice por qué peso se empieza y a cuál se llega', () => {
    const { container } = setup();

    // Los tres peldaños se leen como cifras, no como nombres: es el dato, no una
    // etiqueta. La lista entera es lo que se comprueba, porque el peso y las reps
    // viven en elementos separados.
    const lista = container.querySelector('ul')?.textContent ?? '';
    expect(lista).toMatch(/32\.5 kg\s*×8/);
    expect(lista).toMatch(/65 kg\s*×5/);
    expect(lista).toMatch(/82\.5 kg\s*×8/);
    // Y el pie explica qué son los dos primeros peldaños: una escalera sin
    // rotular no dice nada, por muy bonita que sea la escala.
    expect(screen.getByText(/Las de arriba son de calentamiento/)).toBeInTheDocument();
  });

  it('no esconde la corrección: sigue ahí, tras un botón', async () => {
    const user = userEvent.setup();
    setup();

    // De entrada, ni una fila por serie ni un campo de formulario encima.
    expect(screen.queryByPlaceholderText('Reps')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajustar serie a serie/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ajustar serie a serie/ }));

    // Abierto el panel, cada serie sigue siendo una fila que se despliega, y
    // solo una a la vez.
    await user.click(screen.getByText('1'));
    expect(screen.getAllByPlaceholderText('Reps')).toHaveLength(1);
  });

  it('marca la corrección como del usuario para que el motor no la pise', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: /Ajustar serie a serie/ }));
    await user.click(screen.getByText('1'));
    await user.type(screen.getByPlaceholderText('kg'), '8');

    // `weightTouched` es el cierre del bucle: sin él, `prefillAdvisedWeight`
    // devolvería la serie a 82,5 y la app guardaría su propia sugerencia como si
    // fuera lo que el usuario levantó.
    //
    // No se mira el dígito final. El campo está controlado y aquí el store es un
    // mock, así que el valor pintado se queda clavado en «82.5» y lo tecleado se
    // le acumula encima: comprobar «82.58» sería fijarse a un artefacto del
    // arnés. Lo que importa es que *toda* corrección de peso venga marcada.
    const cambiosDePeso = updateSet.mock.calls
      .map(([, , patch]) => patch as { weight?: string; weightTouched?: boolean })
      .filter((patch) => patch.weight !== undefined);
    expect(cambiosDePeso.length).toBeGreaterThan(0);
    expect(cambiosDePeso.every((patch) => patch.weightTouched === true)).toBe(true);
  });

  it('deja el RPE a mano sin abrir nada porque es lo que enciende el motor', () => {
    setup();

    // El RPE es por ejercicio, no por serie: sin él el motor cae al respaldo de
    // doble progresión y la descarga no se propone nunca. Por eso vive fuera del
    // panel de ajuste: no es una corrección, es una respuesta del usuario.
    expect(screen.getByRole('group', { name: /RPE/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^RPE/i })).toHaveLength(5);
  });
});
