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
    render(<Button>Test</Button>);
    expect(screen.getByRole('button', { name: 'Test' }).className).toContain('bg-accent');
  });

  it('aplica variante danger', () => {
    render(<Button variant="danger">Eliminar</Button>);
    expect(screen.getByRole('button', { name: 'Eliminar' }).className).toContain('bg-error');
  });

  it('size sm asigna clase h-9', () => {
    render(<Button size="sm">Pequeño</Button>);
    expect(screen.getByRole('button', { name: 'Pequeño' }).className).toContain('h-9');
  });

  it('disabled desactiva el botón', () => {
    render(<Button disabled>Bloqueado</Button>);
    expect(screen.getByRole('button', { name: 'Bloqueado' })).toHaveProperty('disabled', true);
  });

  it('loading muestra spinner y desactiva', () => {
    render(<Button loading>Cargando</Button>);
    const btn = screen.getByRole('button', { name: 'Cargando' });
    expect(btn).toHaveProperty('disabled', true);
    expect(btn.querySelector('svg')).toBeDefined();
  });

  it('llama onClick al hacer clic', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Click' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('no llama onClick cuando está deshabilitado', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        No
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
