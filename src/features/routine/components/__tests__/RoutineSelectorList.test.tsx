// @vitest-environment jsdom
//
// El selector de rutina se extrajo de RoutinePage sin cambiar ni una clase ni
// una clave de traducción. Estos tests fijan las dos piezas que un refactor así
// puede romper en silencio: qué se pinta (incluido el plegado de las ocultas,
// que era estado local de la página) y qué handler recibe cada botón.
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Routine } from '@features/routine/stores/routineStore';
import { RoutineSelectorList } from '../RoutineSelectorList';

import { resources } from '@shared/lib/i18n/resources';
import { formatShortDay } from '@shared/lib/formatDate';

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

function routine(partial: Partial<Routine> & { id: string; name: string }): Routine {
  return {
    description: '',
    days: {} as Routine['days'],
    isCustom: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

const plantilla = routine({ id: 'r1', name: 'Full body', isCustom: false });
const propia = routine({ id: 'r2', name: 'Mi rutina' });
const oculta = routine({ id: 'r3', name: 'Vieja' });

function setup(overrides: Partial<React.ComponentProps<typeof RoutineSelectorList>> = {}) {
  const props: React.ComponentProps<typeof RoutineSelectorList> = {
    visibles: [plantilla, propia],
    ocultas: [],
    schedule: {},
    hasActiveRoutine: false,
    onKeepCurrent: vi.fn(),
    onSelect: vi.fn(),
    onOpenScheduler: vi.fn(),
    onHide: vi.fn(),
    onUnhide: vi.fn(),
    onUseAsTemplate: vi.fn(),
    onCreate: vi.fn(),
    onImportFile: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<RoutineSelectorList {...props} />) };
}

afterEach(cleanup);

describe('RoutineSelectorList', () => {
  it('pinta todas las rutinas visibles con su nombre y descripción', () => {
    setup({ visibles: [plantilla, propia] });
    expect(screen.getByText('Full body')).toBeInTheDocument();
    expect(screen.getByText('Mi rutina')).toBeInTheDocument();
  });

  it('marca las predefinidas y ofrece usarlas como plantilla; no en las propias', () => {
    setup();
    expect(screen.getByText(t('routine.predefined'))).toBeInTheDocument();
    expect(screen.getByText(t('routine.use_template'))).toBeInTheDocument();
  });

  it('el botón de mantener la actual solo existe con una rutina activa', () => {
    const { unmount } = render(
      <RoutineSelectorList
        visibles={[propia]}
        ocultas={[]}
        schedule={{}}
        hasActiveRoutine={false}
        onKeepCurrent={vi.fn()}
        onSelect={vi.fn()}
        onOpenScheduler={vi.fn()}
        onHide={vi.fn()}
        onUnhide={vi.fn()}
        onUseAsTemplate={vi.fn()}
        onCreate={vi.fn()}
        onImportFile={vi.fn()}
      />,
    );
    expect(screen.queryByText(t('routine.keep_current'))).not.toBeInTheDocument();
    unmount();

    setup({ hasActiveRoutine: true });
    expect(screen.getByText(t('routine.keep_current'))).toBeInTheDocument();
  });

  it('no pinta la sección de ocultas cuando no hay ninguna', () => {
    setup({ ocultas: [] });
    expect(screen.queryByText(t('routine.hidden_hint'))).not.toBeInTheDocument();
  });

  it('las ocultas empiezan plegadas y se despliegan al tocar', async () => {
    const user = userEvent.setup();
    setup({ ocultas: [oculta] });

    expect(screen.queryByText(t('routine.hidden_hint'))).not.toBeInTheDocument();
    await user.click(screen.getByText(t('routine.hidden_show', { count: 1 })));

    expect(screen.getByText(t('routine.hidden_hint'))).toBeInTheDocument();
    expect(screen.getByText('Vieja')).toBeInTheDocument();
    // El aria-expanded sigue el estado real, no una constante.
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
  });

  it('ocultar recibe la rutina entera, no solo el id (el aviso necesita el nombre)', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    await user.click(screen.getByLabelText(t('routine.hide_action', { name: 'Mi rutina' })));
    expect(props.onHide).toHaveBeenCalledWith(propia);
  });

  it('seleccionar una rutina avisa con su id', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    await user.click(screen.getByText('Mi rutina'));
    expect(props.onSelect).toHaveBeenCalledWith('r2');
  });

  it('el teclado también selecciona (Enter y espacio)', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    const tarjeta = screen.getByText('Mi rutina').closest('[role="button"]');
    expect(tarjeta).not.toBeNull();
    (tarjeta as HTMLElement).focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(props.onSelect).toHaveBeenCalledTimes(2);
    expect(props.onSelect).toHaveBeenCalledWith('r2');
  });

  it('la fecha programada solo se enseña en la tarjeta programada', () => {
    setup({ schedule: { r1: '2026-04-01' } });

    const insignias = screen.getAllByText(/Empieza el/);
    expect(insignias).toHaveLength(1);
    expect(insignias[0]?.textContent).toBe(`Empieza el ${formatShortDay('2026-04-01', 'es')}`);
  });

  it('restaurar una oculta llama a onUnhide con su id', async () => {
    const user = userEvent.setup();
    const { props } = setup({ ocultas: [oculta] });

    await user.click(screen.getByText(t('routine.hidden_show', { count: 1 })));
    await user.click(screen.getByText(t('routine.unhide_short')));
    expect(props.onUnhide).toHaveBeenCalledWith('r3');
  });
});
