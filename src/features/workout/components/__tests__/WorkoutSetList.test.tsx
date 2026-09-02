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
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

const LB_PER_KG = 2.20462;

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

  render(
    <WorkoutSetList
      sets={overrides.sets ?? [{ id: 'a', reps: '8', weight: '100' }]}
      showWarmupSets={false}
      setErrors={overrides.setErrors ?? {}}
      setSetErrors={setSetErrors}
      updateSet={updateSet}
      removeSet={removeSet}
      onCommitSet={onCommitSet}
      loggingMode={overrides.loggingMode ?? 'reps'}
      onLoggingModeChange={vi.fn()}
      checkIsNewPR={() => false}
      weightUnit={overrides.weightUnit ?? 'kg'}
      convert={overrides.convert ?? ((kg) => kg)}
      convertToKg={overrides.convertToKg ?? ((local) => local)}
    />,
  );

  return { updateSet, removeSet, setSetErrors, onCommitSet };
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
        loggingMode="reps"
        onLoggingModeChange={vi.fn()}
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

    // `durationSeconds: ''` va en la misma llamada a propósito: una serie es de
    // repeticiones o de tiempo, y dejar las dos haría que una plancha entrase en
    // el volumen de fuerza (ver `setShape.isRepSet`).
    expect(updateSet).toHaveBeenCalledWith(0, { reps: '1', durationSeconds: '' });
    expect(updateSet).toHaveBeenLastCalledWith(0, { reps: '2', durationSeconds: '' });
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

  it('señala la serie con error aunque no sea la que se está editando', async () => {
    const user = userEvent.setup();
    setup({
      sets: [
        { id: 'a', reps: '', weight: '' },
        { id: 'b', reps: '8', weight: '100' },
      ],
      setErrors: { 0: 'Inválido' },
    });

    // Se abre la última serie, que no tiene error. La rota es la otra, y antes
    // no se veía por ningún lado: Guardar no hacía nada y nadie decía por qué.
    expect(repsInput(2)).not.toHaveClass('border-error');
    const filaRota = screen.getByRole('button', { name: 'workout.edit_set 1' });
    expect(filaRota).toHaveAttribute('aria-invalid', 'true');
    expect(filaRota).toHaveTextContent('Inválido');

    // Y al abrirla, el error también sale bajo el campo grande.
    await user.click(filaRota);
    expect(screen.getByText('Inválido')).toBeInTheDocument();
    expect(repsInput(1)).toHaveClass('border-error');
  });

  it('no marca como hecha una serie sin repeticiones ni segundos', async () => {
    const user = userEvent.setup();
    const { updateSet, setSetErrors, onCommitSet } = setup({
      sets: [{ id: 'a', reps: '', weight: '125' }],
    });

    await user.click(screen.getByLabelText('workout.complete_set'));

    // Ni se completa ni se abre la siguiente: eso dejaba un «125 kg × 0» que
    // luego frenaba el guardado del entreno entero.
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

    await user.click(screen.getByLabelText('workout.complete_set'));

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
    // Es lo que pasa al reabrir la app a mitad de entreno: `loggingMode` vuelve
    // a 'reps' pero la serie guardada tiene 48 segundos. Antes se pintaba
    // «REPS 0» encima de un dato correcto — la lectura mentía.
    setup({
      sets: [{ id: 'a', reps: '', weight: '0', durationSeconds: '48' }],
      loggingMode: 'reps',
    });

    expect(screen.getByLabelText('workout.seconds 1')).toHaveValue('48');
    expect(screen.queryByLabelText('workout.reps 1')).not.toBeInTheDocument();
  });

  it('una serie con reps se lee en modo reps aunque el padre diga tiempo', () => {
    setup({
      sets: [{ id: 'a', reps: '10', weight: '100' }],
      loggingMode: 'time',
    });

    expect(repsInput()).toHaveValue('10');
  });

  it('una serie vacía sigue lo que eligió el usuario', () => {
    setup({ sets: [{ id: 'a', reps: '', weight: '' }], loggingMode: 'time' });
    expect(screen.getByLabelText('workout.seconds 1')).toBeInTheDocument();
  });

  it('cambiar a tiempo borra las reps: una serie no puede medir las dos cosas', async () => {
    const user = userEvent.setup();
    const { updateSet } = setup({
      sets: [{ id: 'a', reps: '10', weight: '100' }],
      loggingMode: 'reps',
    });

    await user.click(screen.getByRole('radio', { name: 'workout.mode_time' }));

    // Con reps Y segundos, `setShape.isRepSet` la contaría como serie de fuerza
    // y la plancha entraría en el volumen.
    expect(updateSet).toHaveBeenCalledWith(0, { reps: '' });
  });

  it('cambiar a reps borra los segundos', async () => {
    const user = userEvent.setup();
    const { updateSet } = setup({
      sets: [{ id: 'a', reps: '', weight: '0', durationSeconds: '48' }],
      loggingMode: 'time',
    });

    await user.click(screen.getByRole('radio', { name: 'workout.mode_reps' }));

    expect(updateSet).toHaveBeenCalledWith(0, { durationSeconds: '' });
  });
});
