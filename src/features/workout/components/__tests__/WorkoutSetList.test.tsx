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
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { WorkoutSetList } from '../WorkoutSetList';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@shared/lib/haptics', () => ({
  impact: vi.fn(),
  ImpactStyle: { Light: 'LIGHT' },
}));

const LB_PER_KG = 2.20462;

interface Overrides {
  sets?: { id: string; reps: string; weight: string }[];
  weightUnit?: string;
  convert?: (kg: number) => number;
  convertToKg?: (local: number) => number;
  setErrors?: Record<number, string>;
}

function setup(overrides: Overrides = {}) {
  const updateSet = vi.fn();
  const removeSet = vi.fn();
  const setSetErrors = vi.fn();

  render(
    <WorkoutSetList
      sets={overrides.sets ?? [{ id: 'a', reps: '8', weight: '100' }]}
      showWarmupSets={false}
      setErrors={overrides.setErrors ?? {}}
      setSetErrors={setSetErrors}
      updateSet={updateSet}
      removeSet={removeSet}
      checkIsNewPR={() => false}
      weightUnit={overrides.weightUnit ?? 'kg'}
      convert={overrides.convert ?? ((kg) => kg)}
      convertToKg={overrides.convertToKg ?? ((local) => local)}
    />,
  );

  return { updateSet, removeSet, setSetErrors };
}

const repsInput = (n = 1) => screen.getByLabelText(`workout.reps ${n}`);
const weightInput = (unit = 'kg', n = 1) => screen.getByLabelText(`${unit} ${n}`);

describe('WorkoutSetList', () => {
  afterEach(cleanup);

  it('no dibuja nada sin series', () => {
    const { container } = render(
      <WorkoutSetList
        sets={[]}
        showWarmupSets={false}
        setErrors={{}}
        setSetErrors={vi.fn()}
        updateSet={vi.fn()}
        removeSet={vi.fn()}
        checkIsNewPR={() => false}
        weightUnit="kg"
        convert={(kg) => kg}
        convertToKg={(l) => l}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('descarta caracteres no numéricos en reps', async () => {
    const user = userEvent.setup();
    const { updateSet } = setup({ sets: [{ id: 'a', reps: '', weight: '' }] });

    await user.type(repsInput(), '1a2');

    expect(updateSet).toHaveBeenCalledWith(0, { reps: '1' });
    expect(updateSet).toHaveBeenLastCalledWith(0, { reps: '2' });
  });

  it('muestra el peso derivado de kg cuando no se está escribiendo', () => {
    setup({ sets: [{ id: 'a', reps: '8', weight: '100' }] });
    // 100 -> "100", sin el ".0" sobrante.
    expect(weightInput()).toHaveValue('100');
  });

  it('conserva el separador decimal a medio escribir en vez de reformatearlo', async () => {
    const user = userEvent.setup();
    setup({ sets: [{ id: 'a', reps: '8', weight: '' }] });

    await user.type(weightInput(), '82,');

    // Si el valor se derivara del store, la coma final desaparecería y el
    // usuario no podría escribir decimales.
    expect(weightInput()).toHaveValue('82,');
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

    const lastCall = updateSet.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    expect(Number(lastCall?.[1].weight)).toBeCloseTo(220 / LB_PER_KG, 5);
  });

  it('al salir del campo vuelve al valor derivado del store', async () => {
    const user = userEvent.setup();
    setup({ sets: [{ id: 'a', reps: '8', weight: '100' }] });

    const input = weightInput();
    await user.clear(input);
    await user.type(input, '82,');
    expect(input).toHaveValue('82,');

    await user.tab();
    // El padre no ha actualizado `sets` (updateSet está mockeado), así que se
    // vuelve a mostrar el 100 original: prueba que el texto local se descartó.
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

    expect(setSetErrors).toHaveBeenCalled();
    // El updater borra solo la clave de esta fila.
    const updater = setSetErrors.mock.calls[0][0] as (
      p: Record<number, string>,
    ) => Record<number, string>;
    expect(updater({ 0: 'Inválido', 1: 'Otro' })).toEqual({ 1: 'Otro' });
  });

  it('solo pinta el error de la serie que se está editando', async () => {
    const user = userEvent.setup();
    setup({
      sets: [
        { id: 'a', reps: '', weight: '' },
        { id: 'b', reps: '8', weight: '100' },
      ],
      setErrors: { 0: 'Inválido' },
    });

    // Se abre la última serie, que no tiene error.
    expect(screen.queryByText('Inválido')).not.toBeInTheDocument();
    expect(repsInput(2)).not.toHaveClass('border-error');

    // Al volver a la primera, sí.
    await user.click(screen.getByRole('button', { name: 'workout.edit_set 1' }));
    expect(screen.getByText('Inválido')).toBeInTheDocument();
    expect(repsInput(1)).toHaveClass('border-error');
  });

  it('borra la serie que se está editando por su índice', async () => {
    const user = userEvent.setup();
    const { removeSet } = setup({
      sets: [
        { id: 'a', reps: '8', weight: '100' },
        { id: 'b', reps: '6', weight: '110' },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'workout.session_remove_set 2' }));
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

    // Con dos series se edita la última (índice 1, etiquetas «… 2»).
    await user.clear(weightInput('kg', 2));
    await user.type(weightInput('kg', 2), '82,5');
    expect(weightInput('kg', 2)).toHaveValue('82,5');

    // Al pasar a la primera se muestra su valor derivado del store, no el texto
    // que se estaba escribiendo en la otra.
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
    expect(row).toHaveTextContent('60 kg × 12');
  });
});
