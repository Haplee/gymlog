// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Toggle } from '../Toggle';
import { SegmentedControl } from '../SegmentedControl';
import { StatNumber } from '../StatNumber';
import { Chip } from '../Chip';
import { FAB } from '../FAB';
import { SectionHeader } from '../SectionHeader';

afterEach(cleanup);

describe('Toggle', () => {
  it('renderiza role switch con aria-checked', () => {
    render(<Toggle checked={true} onChange={() => {}} ariaLabel="Sonido" />);
    const sw = screen.getByRole('switch', { name: 'Sonido' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('llama onChange con el valor invertido', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Sonido" />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disabled no llama onChange', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled ariaLabel="Sonido" />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'kg', label: 'KG' },
    { value: 'lb', label: 'LB' },
  ] as const;

  it('renderiza radiogroup con opción activa marcada', () => {
    render(
      <SegmentedControl options={[...options]} value="kg" onChange={() => {}} ariaLabel="Unidad" />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Unidad' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'KG' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'LB' }).getAttribute('aria-checked')).toBe('false');
  });

  it('llama onChange con el value seleccionado', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl options={[...options]} value="kg" onChange={onChange} ariaLabel="Unidad" />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'LB' }));
    expect(onChange).toHaveBeenCalledWith('lb');
  });
});

describe('StatNumber', () => {
  it('renderiza valor, sufijo y label', () => {
    render(<StatNumber value="102.5" suffix="KG" label="Volumen" />);
    expect(screen.getByText('102.5')).toBeDefined();
    expect(screen.getByText('KG')).toBeDefined();
    expect(screen.getByText('Volumen')).toBeDefined();
  });

  it('aplica la clase del tamaño huge', () => {
    const { container } = render(<StatNumber value="12" size="huge" />);
    expect(container.innerHTML).toContain('text-display-huge');
  });
});

describe('Chip', () => {
  it('marca aria-pressed cuando está seleccionado', () => {
    render(
      <Chip selected onClick={() => {}}>
        Pecho
      </Chip>,
    );
    expect(screen.getByRole('button', { name: 'Pecho' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('llama onClick al pulsar', async () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Pecho</Chip>);
    await userEvent.click(screen.getByRole('button', { name: 'Pecho' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('variant day usa tamaño cuadrado w-11', () => {
    render(
      <Chip variant="day" onClick={() => {}}>
        Lun
      </Chip>,
    );
    expect(screen.getByRole('button', { name: 'Lun' }).className).toContain('w-11');
  });
});

describe('FAB', () => {
  it('renderiza icono y label caps', () => {
    render(<FAB icon={<svg data-testid="icon" />} label="Crear" />);
    expect(screen.getByTestId('icon')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDefined();
  });

  it('llama onClick al pulsar', async () => {
    const onClick = vi.fn();
    render(<FAB icon={<svg />} label="Crear" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sin label acepta aria-label', () => {
    render(<FAB icon={<svg />} aria-label="Añadir" />);
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeDefined();
  });
});

describe('SectionHeader', () => {
  it('renderiza el título como heading', () => {
    render(<SectionHeader title="Preferencias" />);
    expect(screen.getByRole('heading', { name: 'Preferencias' })).toBeDefined();
  });

  it('renderiza el nodo de acción', () => {
    render(<SectionHeader title="Datos" action={<button>Ver todo</button>} />);
    expect(screen.getByRole('button', { name: 'Ver todo' })).toBeDefined();
  });
});
