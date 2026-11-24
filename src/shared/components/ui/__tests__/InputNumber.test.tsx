// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputNumber } from '../InputNumber';

type ControlledInputProps = Omit<ComponentProps<typeof InputNumber>, 'value' | 'onChange'> & {
  initialValue: string;
};

function ControlledInput({ initialValue, ...props }: ControlledInputProps) {
  const [value, setValue] = useState(initialValue);
  return <InputNumber {...props} value={value} onChange={setValue} />;
}

afterEach(cleanup);

describe('InputNumber', () => {
  it('incrementa y decrementa con el stepper', async () => {
    const user = userEvent.setup();
    render(<ControlledInput initialValue="20" label="Peso" step={2.5} decimals={1} />);

    const input = screen.getByRole('textbox', { name: 'Peso' });
    await user.click(screen.getByRole('button', { name: 'Aumentar Peso' }));
    expect(input).toHaveValue('22.5');

    await user.click(screen.getByRole('button', { name: 'Disminuir Peso' }));
    expect(input).toHaveValue('20.0');
  });

  it('respeta los límites mínimo y máximo desde los steppers', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ControlledInput initialValue="1" label="Repeticiones" min={1} max={10} step={2} />,
    );

    const input = screen.getByRole('textbox', { name: 'Repeticiones' });
    await user.click(screen.getByRole('button', { name: 'Disminuir Repeticiones' }));
    expect(input).toHaveValue('1');

    unmount();
    render(<ControlledInput initialValue="9" label="Repeticiones" min={1} max={10} step={2} />);
    await user.click(screen.getByRole('button', { name: 'Aumentar Repeticiones' }));
    expect(screen.getByRole('textbox', { name: 'Repeticiones' })).toHaveValue('10');
  });

  it('acepta decimales durante la edición y elimina caracteres no numéricos', () => {
    const onChange = vi.fn();
    render(<InputNumber value="" onChange={onChange} label="Peso" decimals={2} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Peso' }), {
      target: { value: '12.5kg' },
    });

    expect(onChange).toHaveBeenLastCalledWith('12.5');
  });

  it('normaliza, redondea y limita el valor decimal al perder el foco', () => {
    render(<ControlledInput initialValue="" label="Peso" min={0} max={100} decimals={2} />);
    const input = screen.getByRole('textbox', { name: 'Peso' });

    fireEvent.change(input, { target: { value: '12.345' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('12.35');

    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('100.00');
  });

  it('limita enteros y deja vacío un valor incompleto al perder el foco', () => {
    render(<ControlledInput initialValue="" label="Repeticiones" min={0} max={20} />);
    const input = screen.getByRole('textbox', { name: 'Repeticiones' });

    fireEvent.change(input, { target: { value: '12.9 reps' } });
    expect(input).toHaveValue('129');
    fireEvent.blur(input);
    expect(input).toHaveValue('20');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('');
  });

  it('expone etiquetas, límites y estado de error para lectores de pantalla', () => {
    render(
      <InputNumber value="8" onChange={vi.fn()} label="Repeticiones" min={1} max={20} error />,
    );

    const input = screen.getByRole('textbox', { name: 'Repeticiones' });
    expect(screen.getByRole('group', { name: 'Repeticiones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disminuir Repeticiones' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Aumentar Repeticiones' })).toBeEnabled();
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-valuemin', '1');
    expect(input).toHaveAttribute('aria-valuemax', '20');
  });

  it('desactiva tanto el campo como los steppers', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputNumber value="5" onChange={onChange} label="Peso" disabled />);

    expect(screen.getByRole('textbox', { name: 'Peso' })).toBeDisabled();
    const increment = screen.getByRole('button', { name: 'Aumentar Peso' });
    const decrement = screen.getByRole('button', { name: 'Disminuir Peso' });
    expect(increment).toBeDisabled();
    expect(decrement).toBeDisabled();

    await user.click(increment);
    await user.click(decrement);
    expect(onChange).not.toHaveBeenCalled();
  });
});
