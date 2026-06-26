// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  afterEach(cleanup);

  it('renderiza children', () => {
    render(<Button>Hola</Button>);
    expect(screen.getByRole('button', { name: 'Hola' })).toBeDefined();
  });

  it('aplica variante primary por defecto', () => {
    const { container } = render(<Button>Test</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-accent');
  });

  it('aplica variante danger', () => {
    const { container } = render(<Button variant="danger">Eliminar</Button>);
    expect(container.querySelector('button')!.className).toContain('bg-error');
  });

  it('size sm asigna clase h-9', () => {
    const { container } = render(<Button size="sm">Pequeño</Button>);
    expect(container.querySelector('button')!.className).toContain('h-9');
  });

  it('disabled desactiva el botón', () => {
    render(<Button disabled>Bloqueado</Button>);
    expect(screen.getByRole('button', { name: 'Bloqueado' })).toHaveProperty('disabled', true);
  });

  it('loading muestra spinner y desactiva', () => {
    const { container } = render(<Button loading>Cargando</Button>);
    const btn = container.querySelector('button')!;
    expect(btn).toHaveProperty('disabled', true);
    expect(btn.querySelector('svg')).toBeDefined();
  });

  it('llama onClick al hacer clic', async () => {
    const onClick = vi.fn();
    const { container } = render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(container.querySelector('button')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('no llama onClick cuando está deshabilitado', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button disabled onClick={onClick}>
        No
      </Button>,
    );
    await userEvent.click(container.querySelector('button')!);
    expect(onClick).not.toHaveBeenCalled();
  });
});
