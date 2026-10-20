// @vitest-environment jsdom
//
// La fila de la biblioteca es donde se reconocen los ejercicios de un vistazo:
// grupo muscular, material, compuesto/aislado y bilateral/unilateral. Estos
// tests fijan que cada uno de esos datos salga cuando está y que NO invente
// etiqueta cuando no hay dato (el `is_bilateral` nulo es el caso peligroso).
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { LibraryExercise } from '@shared/api/queries';
import { ExerciseLibraryRow } from '../ExerciseLibraryRow';

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string | number>) => t(k, p),
    i18n: { language: 'es' },
  }),
}));

function exercise(partial: Partial<LibraryExercise> = {}): LibraryExercise {
  return {
    id: 'e1',
    name: 'Press banca',
    muscle_group: 'Pecho',
    muscle_detail: 'Pectoral mayor',
    equipment: 'Barra',
    movement: null,
    description: null,
    media_url: null,
    is_compound: true,
    is_bilateral: true,
    load_type: 'external',
    ...partial,
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof ExerciseLibraryRow>> = {}) {
  const props: React.ComponentProps<typeof ExerciseLibraryRow> = {
    exercise: exercise(),
    expanded: false,
    onToggle: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ExerciseLibraryRow {...props} />) };
}

afterEach(cleanup);

describe('ExerciseLibraryRow', () => {
  it('enseña nombre, grupo muscular y material', () => {
    setup();
    expect(screen.getByText('Press banca')).toBeInTheDocument();
    expect(screen.getByText('Pecho')).toBeInTheDocument();
    expect(screen.getByText('Barra')).toBeInTheDocument();
  });

  it('marca compuesto y bilateral cuando lo son', () => {
    setup();
    expect(screen.getByText(t('library.compound'))).toBeInTheDocument();
    expect(screen.getByText(t('library.bilateral'))).toBeInTheDocument();
  });

  it('marca aislado y unilateral en el caso contrario', () => {
    setup({ exercise: exercise({ is_compound: false, is_bilateral: false }) });
    expect(screen.getByText(t('library.isolation'))).toBeInTheDocument();
    expect(screen.getByText(t('library.unilateral'))).toBeInTheDocument();
    expect(screen.queryByText(t('library.compound'))).not.toBeInTheDocument();
  });

  it('sin dato de bilateralidad no inventa ninguna de las dos etiquetas', () => {
    setup({ exercise: exercise({ is_bilateral: null }) });
    expect(screen.queryByText(t('library.bilateral'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('library.unilateral'))).not.toBeInTheDocument();
  });

  it('el GIF sigue mandando cuando existe', () => {
    const { container } = setup({ exercise: exercise({ media_url: 'https://x/banca.gif' }) });
    // La imagen va como fondo de la capa que cubre el icono: si carga, tapa el
    // icono; si no, la capa no pinta nada y se ve el icono de debajo.
    const capa = container.querySelector<HTMLElement>(`[style*="banca.gif"]`);
    expect(capa).not.toBeNull();
    expect(capa?.style.backgroundImage).toContain('https://x/banca.gif');
  });

  it('sin GIF cae al icono anatómico en vez de quedarse sin imagen', () => {
    const { container } = setup({ exercise: exercise({ media_url: null }) });
    expect(container.querySelector('[style*="banca.gif"]')).toBeNull();
    // El icono del grupo muscular es SVG dentro del cuadro de la miniatura.
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('tocar la fila avisa con su id y refleja el estado plegado', async () => {
    const user = userEvent.setup();
    const { props } = setup({ expanded: false });
    await user.click(screen.getByRole('button', { expanded: false }));
    expect(props.onToggle).toHaveBeenCalledWith('e1');
  });

  it('desplegada enseña la descripción y avisa del estado', () => {
    setup({ exercise: exercise({ description: 'Baja la barra al pecho' }), expanded: true });
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
    expect(screen.getByText('Baja la barra al pecho')).toBeInTheDocument();
  });
});
