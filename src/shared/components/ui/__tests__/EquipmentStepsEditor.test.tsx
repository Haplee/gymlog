// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { weight?: number }) =>
      options?.weight === undefined ? key : `${key}:${options.weight}`,
  }),
}));

import { useSettingsStore } from '@shared/stores/settingsStore';
import { EquipmentStepsEditor } from '../EquipmentStepsEditor';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.persist.clearStorage();
  useSettingsStore.setState({
    dumbbellStepsKg: [],
    machineStepsKg: [],
  });
});

afterEach(cleanup);

describe('EquipmentStepsEditor', () => {
  it('muestra los peldaños de mancuernas con formato decimal español', () => {
    useSettingsStore.setState({ dumbbellStepsKg: [2.5, 10] });

    render(<EquipmentStepsEditor family="dumbbell" />);

    expect(screen.getByText('2,5 kg')).toBeInTheDocument();
    expect(screen.getByText('10 kg')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'workout.remove_step:10' })).toBeInTheDocument();
  });

  it('elimina el peldaño seleccionado', () => {
    useSettingsStore.setState({ dumbbellStepsKg: [2.5, 10] });
    render(<EquipmentStepsEditor family="dumbbell" />);

    fireEvent.click(screen.getByRole('listitem', { name: 'workout.remove_step:10' }));

    expect(useSettingsStore.getState().dumbbellStepsKg).toEqual([2.5]);
  });

  it('añade un peso decimal y limpia el borrador', () => {
    render(<EquipmentStepsEditor family="dumbbell" />);
    const input = screen.getByLabelText('workout.dumbbell_steps');

    fireEvent.change(input, { target: { value: '3,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'workout.add_step' }));

    expect(useSettingsStore.getState().dumbbellStepsKg).toEqual([3.5]);
    expect(input).toHaveValue('');
  });

  it('no añade pesos inválidos', () => {
    render(<EquipmentStepsEditor family="machine" />);
    const input = screen.getByLabelText('workout.machine_steps');

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'workout.add_step' }));

    expect(useSettingsStore.getState().machineStepsKg).toEqual([]);
    expect(input).toHaveValue('abc');
  });

  it('añade el peso al pulsar Enter', () => {
    render(<EquipmentStepsEditor family="machine" />);
    const input = screen.getByLabelText('workout.machine_steps');

    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useSettingsStore.getState().machineStepsKg).toEqual([5]);
  });

  it('muestra el estado vacío cuando la familia no tiene peldaños', () => {
    render(<EquipmentStepsEditor family="dumbbell" />);

    expect(screen.getByText('workout.equipment_steps_empty')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
