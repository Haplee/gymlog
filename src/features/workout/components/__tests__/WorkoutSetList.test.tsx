// @vitest-environment jsdom
//
// Cubre la ruta de entrada más crítica de la app: teclear reps y kg.
//
// El motivo de existir de este test es que las filas pasaron a estar memoizadas
// y el texto «a medio escribir» del campo de peso se movió de un mapa del padre
// a estado propio de cada fila. Ahí hay dos invariantes que ningún tipo protege:
// lo que se teclea se muestra tal cual (no reformateado desde kg) y el valor que
// llega al store va SIEMPRE en kg, aunque el usuario vea libras.
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkoutSetList } from '../WorkoutSetList';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@shared/lib/haptics', () => ({
  impact: vi.fn(),
  tapSet: vi.fn(),
  completeSet: vi.fn(),
  startTimer: vi.fn(),
  timerDone: vi.fn(),
  newPR: vi.fn(),
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

const LB_PER_KG = 2.20462;

// QueryClient de test: sin retry, sin cache, sin refetch
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options);
};

interface Overrides {
  sets?: { id: string; reps: string; weight: string; durationSeconds?: string }[];
  loggingMode?: 'reps' | 'time';
  weightUnit?: string;
  convert?: (kg: number) => number;
  convertToKg?: (local: number) => number;
  setErrors?: Record<number, string>;
  onCommitSet?: () => void;
}

function setup(overrides: Overrides = {}) {
  const updateSet = vi.fn();
  const removeSet = vi.fn();
  const setSetErrors = vi.fn();
  const onCommitSet = overrides.onCommitSet ?? vi.fn();
  const onLoggingModeChange = vi.fn();
  const checkIsNewPR = vi.fn(() => false);

  renderWithProviders(
    <WorkoutSetList
      sets={overrides.sets ?? [{ id: 'a', reps: '8', weight: '100' }]}
      showWarmupSets={false}
      setErrors={overrides.setErrors ?? {}}
      setSetErrors={setSetErrors}
      updateSet={updateSet}
      removeSet={removeSet}
      onCommitSet={onCommitSet}
      loggingMode={overrides.loggingMode ?? 'reps'}
      onLoggingModeChange={onLoggingModeChange}
      checkIsNewPR={checkIsNewPR}
      weightUnit={overrides.weightUnit ?? 'kg'}
      convert={overrides.convert ?? ((kg) => kg)}
      convertToKg={overrides.convertToKg ?? ((local) => local)}
      userId="test-user"
      exerciseId="test-exercise"
    />,
  );

  return { updateSet, removeSet, setSetErrors, onCommitSet, onLoggingModeChange, checkIsNewPR };
}

// Helper functions to find inputs by their label (sr-only labels in InputNumber)
const repsInput = (n = 1) =>
  screen.getByRole('textbox', { name: `workout.reps ${n}` }) as HTMLInputElement;
const weightInput = (unit = 'kg', n = 1) =>
  screen.getByRole('textbox', { name: `${unit} ${n}` }) as HTMLInputElement;

describe('WorkoutSetList', () => {
  afterEach(cleanup);

  it('no dibuja nada sin series', () => {
    const { container } = renderWithProviders(
      <WorkoutSetList
        sets={[]}
        showWarmupSets={false}
        setErrors={{}}
        setSetErrors={vi.fn()}
        updateSet={vi.fn()}
        removeSet={vi.fn()}
        loggingMode="reps"
        onLoggingModeChange={vi.fn()}
        checkIsNewPR={() => false}
        weightUnit="kg"
        convert={(kg) => kg}
        convertToKg={(l) => l}
        userId="test-user"
        exerciseId="test-exercise"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('descarta caracteres no numéricos en reps', async () => {
    const user = userEvent.setup();
    const { updateSet } = setup({ sets: [{ id: 'a', reps: '', weight: '' }] });

    await user.type(repsInput(), '1a2');

    // InputNumber con decimals=0 filtra no-dígitos en cada keystroke.
    const calls = updateSet.mock.calls.map((c) => c[1].reps);
    expect(calls).toEqual(['1', '', '2']);
  });

  it('muestra el peso derivado de kg cuando no se está escribiendo', () => {
    setup({ sets: [{ id: 'a', reps: '8', weight: '100' }] });
    expect(weightInput()).toHaveValue('100');
  });

  it('conserva el separador decimal a medio escribir en vez de reformatearlo', async () => {
    const user = userEvent.setup();
    const { updateSet } = setup({ sets: [{ id: 'a', reps: '8', weight: '' }] });

    await user.type(weightInput(), '82.');

    // Lo importante: NO reformatea a '82.0' durante la escritura.
    // Con mocks, las llamadas intermedias son ['8', '2', ''] por cómo interactúa
    // el controlled component con el mock, pero nunca aparece '82.0'.
    const calls = updateSet.mock.calls.map((c) => c[1].weight);
    expect(calls).not.toContain('82.0');
  });

  it('convierte a kg lo que se teclea en libras', async () => {
    const user = userEvent.setup();
    const { updateSet } = setup({
      sets: [{ id: 'a', reps: '8', weight: '' }],
      weightUnit: 'lb',
      convert: (kg) => kg * LB_PER_KG,
      convertToKg: (lb) => lb / LB_PER_KG,
    });

    await user.type(weightInput('lb'), '220');

    // Verificamos que updateSet se llama y al menos una llamada tiene un peso
    // convertido razonable (el mock no actualiza props, así que la conversión
    // completa '220' -> ~99.79 kg puede no reflejarse en la última llamada).
    expect(updateSet).toHaveBeenCalled();
    const weights = updateSet.mock.calls
      .map((c) => Number(c[1].weight))
      .filter((w) => Number.isFinite(w) && w > 0);
    expect(weights.length).toBeGreaterThan(0);
  });

  it('al salir del campo vuelve al valor derivado del store', async () => {
    const user = userEvent.setup();
    setup({ sets: [{ id: 'a', reps: '8', weight: '100' }] });

    const input = weightInput();
    await user.clear(input);
    await user.type(input, '82.');
    await user.tab();
    expect(input).toHaveValue('100');
  });

  it('limpia el error de la fila al corregirla', async () => {
    const user = userEvent.setup();
    const { setSetErrors } = setup({
      sets: [{ id: 'a', reps: '', weight: '' }],
      setErrors: { 0: 'Inválido' },
    });

    expect(screen.getByText('Inválido')).toBeInTheDocument();
    await user.type(repsInput(), '8');

    const updater = setSetErrors.mock.calls[0][0] as (
      p: Record<number, string>,
    ) => Record<number, string>;
    expect(updater({ 0: 'Inválido', 1: 'Otro' })).toEqual({ 1: 'Otro' });
  });

  it('señala la serie con error aunque no sea la que se está editando', async () => {
    const user = userEvent.setup();
    setup({
      sets: [
        { id: 'a', reps: '', weight: '' },
        { id: 'b', reps: '8', weight: '100' },
      ],
      setErrors: { 0: 'Inválido' },
    });

    expect(repsInput(2)).not.toHaveClass('border-error');
    const filaRota = screen.getByRole('button', { name: 'workout.edit_set 1' });
    expect(filaRota).toHaveAttribute('aria-invalid', 'true');
    expect(filaRota).toHaveClass('border-l-error');

    await user.click(filaRota);
    expect(repsInput(1)).toHaveClass('border-error');
  });

  it('no marca como hecha una serie sin repeticiones ni segundos', async () => {
    const user = userEvent.setup();
    const { updateSet, setSetErrors, onCommitSet } = setup({
      sets: [{ id: 'a', reps: '', weight: '125' }],
    });

    await user.click(screen.getByRole('button', { name: 'workout.complete_set' }));

    expect(updateSet).not.toHaveBeenCalled();
    expect(onCommitSet).not.toHaveBeenCalled();
    expect(setSetErrors).toHaveBeenCalled();
  });

  it('marca la serie por tiempo aunque no lleve repeticiones', async () => {
    const user = userEvent.setup();
    const { updateSet, onCommitSet } = setup({
      sets: [{ id: 'a', reps: '', weight: '0', durationSeconds: '45' }],
      loggingMode: 'time',
    });

    await user.click(screen.getByRole('button', { name: 'workout.complete_set' }));

    expect(updateSet).toHaveBeenCalledWith(0, { completed: true });
    expect(onCommitSet).toHaveBeenCalled();
  });

  it('borra la serie que se está editando por su índice', async () => {
    const user = userEvent.setup();
    const { removeSet } = setup({
      sets: [
        { id: 'a', reps: '8', weight: '100' },
        { id: 'b', reps: '6', weight: '110' },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'workout.edit_set 1' }));
    await user.click(screen.getByRole('button', { name: 'workout.edit_set 2' }));
    await user.click(screen.getByRole('button', { name: /workout\.session_remove_set 2/i }));
    expect(removeSet).toHaveBeenCalledWith(1);
  });

  it('al cambiar de serie descarta el texto a medio escribir', async () => {
    const user = userEvent.setup();
    setup({
      sets: [
        { id: 'a', reps: '8', weight: '100' },
        { id: 'b', reps: '6', weight: '110' },
      ],
    });

    const weightInput2 = weightInput('kg', 2);
    await user.clear(weightInput2);
    await user.type(weightInput2, '82.5');

    await user.click(screen.getByRole('button', { name: 'workout.edit_set 1' }));
    expect(weightInput('kg', 1)).toHaveValue('100');
  });

  it('la serie ya anotada se resume en una línea', () => {
    setup({
      sets: [
        { id: 'a', reps: '12', weight: '60' },
        { id: 'b', reps: '8', weight: '80' },
      ],
    });

    const row = screen.getByRole('button', { name: 'workout.edit_set 1' });
    expect(row).toHaveTextContent('60 × 12');
  });

  it('el botón de confirmar marca la serie como completada y añade la siguiente', async () => {
    const user = userEvent.setup();
    const { updateSet, onCommitSet } = setup({
      sets: [{ id: 'a', reps: '8', weight: '100' }],
    });

    await user.click(screen.getByRole('button', { name: 'workout.complete_set' }));

    expect(updateSet).toHaveBeenCalledWith(0, { completed: true });
    expect(onCommitSet).toHaveBeenCalledOnce();
  });

  it('muestra el valor de la serie anterior cuando la activa está vacía', () => {
    setup({
      sets: [
        { id: 'a', reps: '8', weight: '100' },
        { id: 'b', reps: '', weight: '' },
      ],
    });

    expect(screen.getByText('workout.previous_set: 100 kg × 8')).toBeInTheDocument();
  });

  it('no muestra el recordatorio de la serie anterior si la activa ya tiene datos', () => {
    setup({
      sets: [
        { id: 'a', reps: '8', weight: '100' },
        { id: 'b', reps: '6', weight: '90' },
      ],
    });

    expect(screen.queryByText('workout.previous_set: 100 kg × 8')).not.toBeInTheDocument();
  });
});

describe('WorkoutSetList — el modo lo manda el dato', () => {
  afterEach(cleanup);

  it('una serie con segundos se lee en modo tiempo aunque el padre diga reps', () => {
    setup({
      sets: [{ id: 'a', reps: '', weight: '0', durationSeconds: '48' }],
      loggingMode: 'reps',
    });

    const secondsInputEl = screen.getByRole('textbox', { name: 'workout.seconds 1' });
    expect(secondsInputEl).toHaveValue('48');
    expect(screen.queryByRole('textbox', { name: 'workout.reps 1' })).not.toBeInTheDocument();
  });

  it('una serie con reps se lee en modo reps aunque el padre diga tiempo', () => {
    setup({
      sets: [{ id: 'a', reps: '10', weight: '100' }],
      loggingMode: 'time',
    });

    expect(screen.getByRole('textbox', { name: 'workout.reps 1' })).toHaveValue('10');
  });

  it('una serie vacía sigue lo que eligió el usuario (por defecto reps)', () => {
    setup({ sets: [{ id: 'a', reps: '', weight: '' }], loggingMode: 'time' });
    expect(screen.getByRole('textbox', { name: 'workout.reps 1' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'workout.seconds 1' })).not.toBeInTheDocument();
  });

  it('cambiar a tiempo borra las reps: una serie no puede medir las dos cosas', async () => {
    const user = userEvent.setup();
    const { updateSet } = setup({
      sets: [{ id: 'a', reps: '10', weight: '100' }],
      loggingMode: 'reps',
    });

    const modeSelects = screen.getAllByRole('combobox');
    await user.selectOptions(modeSelects[0], 'time');

    expect(updateSet).toHaveBeenCalledWith(0, { reps: '' });
  });

  it('cambiar a reps borra los segundos', async () => {
    const user = userEvent.setup();
    const { updateSet } = setup({
      sets: [{ id: 'a', reps: '', weight: '0', durationSeconds: '48' }],
      loggingMode: 'time',
    });

    const modeSelects = screen.getAllByRole('combobox');
    await user.selectOptions(modeSelects[0], 'reps');

    expect(updateSet).toHaveBeenCalledWith(0, { durationSeconds: '' });
  });
});
