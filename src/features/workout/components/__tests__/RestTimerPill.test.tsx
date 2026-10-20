// @vitest-environment jsdom
//
// La píldora del descanso se monta ahora en dos pantallas (entrenamiento libre y
// sesión de rutina). Su contrato con quien la monta es justo el que se prueba
// aquí: **no dibuja nada si no hay descanso**, y cuando lo hay enseña la cuenta
// atrás y sus controles. Si dejara de devolver `null` en reposo, la sesión de
// rutina tendría una píldora fantasma debajo de cada tarjeta.
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { RestTimerPill } from '../RestTimerPill';
import { useRestTimerStore } from '../../stores/restTimerStore';
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

// El mock se declara por fichero: el hoisting de `vi.mock` lo sube antes de
// importar el componente.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string | number>) => t(k, p),
    i18n: { language: 'es' },
  }),
}));

describe('RestTimerPill', () => {
  beforeEach(() => {
    useRestTimerStore.setState({
      endTime: null,
      duration: 90,
      isRunning: false,
      alarmRinging: false,
    });
  });

  afterEach(() => cleanup());

  it('no dibuja nada si no hay descanso en marcha', () => {
    const { container } = render(<RestTimerPill />);
    expect(container).toBeEmptyDOMElement();
  });

  it('enseña la cuenta atrás cuando el descanso corre', () => {
    useRestTimerStore.setState({ endTime: Date.now() + 90_000, duration: 90, isRunning: true });
    render(<RestTimerPill />);
    expect(screen.getByText('01:30')).toBeInTheDocument();
  });

  it('en los últimos segundos marca la cifra como urgente', () => {
    useRestTimerStore.setState({ endTime: Date.now() + 5_000, duration: 90, isRunning: true });
    render(<RestTimerPill />);
    // `00:05` cae dentro del tramo de aviso (>0 y <=10).
    expect(screen.getByText('00:05')).toHaveClass('text-error');
  });

  it('despliega los controles y cierra el descanso', async () => {
    const user = userEvent.setup();
    useRestTimerStore.setState({ endTime: Date.now() + 90_000, duration: 90, isRunning: true });
    render(<RestTimerPill />);

    await user.click(screen.getByRole('button', { name: 'Descanso restante' }));
    expect(screen.getByRole('button', { name: '+30s' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(useRestTimerStore.getState().isRunning).toBe(false);
  });
});
