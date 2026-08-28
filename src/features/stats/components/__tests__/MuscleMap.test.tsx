// @vitest-environment jsdom
//
// El mapa es un SVG sin texto: lo único que dice el estado de un músculo es el
// color de su relleno. Por eso aquí se comprueba el relleno y no lo que se lee,
// que es lo que ve el usuario de pie en el gimnasio.
//
// La geometría y la tabla de alias ya tienen sus tests en
// `shared/constants/__tests__/muscleMap.test.ts`; esto cubre lo que decide el
// componente: cómo resuelve un grupo con varios músculos detrás, qué hace con
// lo que no sabe dibujar y cuándo no se pinta nada.
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MuscleMap } from '../MuscleMap';
import type { MuscleGroupStatus } from '../../utils/fatigueAnalysis';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

afterEach(cleanup);

const musculo = (
  name: string,
  status: MuscleGroupStatus['status'],
  daysSinceLast = 1,
): MuscleGroupStatus => ({ name, status, daysSinceLast });

/** Relleno con el que se ha pintado un grupo, leído del SVG que se renderiza. */
function rellenoDe(grupo: string): string | null {
  const forma = document.querySelector(`[data-grupo="${grupo}"]`);
  return forma?.getAttribute('fill') ?? null;
}

describe('MuscleMap', () => {
  it('no se pinta si no hay ni un entreno', () => {
    const { container } = render(<MuscleMap recovery={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('pinta cada estado con su color y los grupos sin datos en gris', () => {
    render(
      <MuscleMap
        recovery={[
          musculo('Pecho', 'recovering'),
          musculo('Pierna', 'partial'),
          musculo('Hombro', 'recovered'),
        ]}
      />,
    );

    expect(rellenoDe('Pecho')).toBe('var(--error)');
    expect(rellenoDe('Pierna')).toBe('var(--warning)');
    expect(rellenoDe('Hombro')).toBe('var(--success)');
    // Nadie ha entrenado el core: gris, que no es un estado de recuperación.
    expect(rellenoDe('Core')).toBe('var(--bg-surface-3)');
  });

  it('cuando varios músculos caen en el mismo grupo manda el menos recuperado', () => {
    // Dorsales y trapecio son «Espalda» en el mapa. Si el trapecio se entrenó
    // ayer, la espalda está trabajada aunque los dorsales lleven una semana.
    render(
      <MuscleMap
        recovery={[musculo('Dorsales', 'recovered', 7), musculo('Trapecio', 'recovering', 1)]}
      />,
    );
    expect(rellenoDe('Espalda')).toBe('var(--error)');
  });

  it('el orden de la lista no cambia el resultado', () => {
    render(
      <MuscleMap
        recovery={[musculo('Trapecio', 'recovering', 1), musculo('Dorsales', 'recovered', 7)]}
      />,
    );
    expect(rellenoDe('Espalda')).toBe('var(--error)');
  });

  it('lo que no tiene sitio en un cuerpo no se dibuja ni tumba el mapa', () => {
    render(<MuscleMap recovery={[musculo('Cardio', 'recovering'), musculo('Otro', 'partial')]} />);
    // Ningún grupo pintado con estado: el mapa entero se queda en gris.
    for (const grupo of ['Pecho', 'Espalda', 'Pierna', 'Core']) {
      expect(rellenoDe(grupo)).toBe('var(--bg-surface-3)');
    }
  });

  it('anuncia las dos vistas para quien no ve el dibujo', () => {
    render(<MuscleMap recovery={[musculo('Pecho', 'recovering')]} />);
    expect(screen.getByRole('img', { name: 'muscleMap.front' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'muscleMap.back' })).toBeTruthy();
  });

  it('nombra los grupos de los que todavía no hay dato', () => {
    render(<MuscleMap recovery={[musculo('Pecho', 'recovering')]} />);
    expect(screen.getByText('muscleMap.untrained_list')).toBeTruthy();
  });
});
