// @vitest-environment jsdom
//
// La tarjeta del día se extrajo de RoutinePage conservando sus tres ramas: día
// liberado por la reorganización, día vacío (propia vs. plantilla) y lista de
// ejercicios. Cada rama lleva a un sitio distinto y una extracción puede
// cruzarlas sin que el linter diga nada.
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Routine } from '@features/routine/stores/routineStore';
import { RoutineDayCard } from '../RoutineDayCard';

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

// La lista ordenable trae dnd-kit y su propio contexto: aquí solo interesa que
// la tarjeta la monte cuando toca, no cómo arrastra.
vi.mock('../SortableExerciseList', () => ({
  SortableExerciseList: ({ exercises }: { exercises: { name: string }[] }) => (
    <ul data-testid="lista-ejercicios">
      {exercises.map((ex) => (
        <li key={ex.name}>{ex.name}</li>
      ))}
    </ul>
  ),
}));

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'r1',
    name: 'Full body',
    description: '',
    days: {} as Routine['days'],
    isCustom: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof RoutineDayCard>> = {}) {
  const props: React.ComponentProps<typeof RoutineDayCard> = {
    routine: routine(),
    selectedDay: 'monday',
    sourceDay: 'monday',
    movedFrom: null,
    dayExercises: [{ name: 'Press banca' }],
    onOpenMovePicker: vi.fn(),
    onOpenExercisePicker: vi.fn(),
    onRestoreWeek: vi.fn(),
    onReorder: vi.fn(),
    onRemove: vi.fn(),
    onEdit: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<RoutineDayCard {...props} />) };
}

afterEach(cleanup);

describe('RoutineDayCard', () => {
  it('con ejercicios pinta la lista y las dos acciones', () => {
    setup();
    expect(screen.getByTestId('lista-ejercicios')).toBeInTheDocument();
    expect(screen.getByText(t('routine.move_day'))).toBeInTheDocument();
    expect(screen.getByText(t('routine.add_exercise'))).toBeInTheDocument();
  });

  it('sin ejercicios el añadir no se duplica en la cabecera (ya está en el vacío)', () => {
    setup({ dayExercises: [] });
    // El estado vacío trae su propio botón; la cabecera no repite el de añadir.
    expect(screen.queryByText(t('routine.add_exercise'))).not.toBeInTheDocument();
    expect(screen.getByText(t('routine.empty_custom_day'))).toBeInTheDocument();
    expect(screen.getByText(t('routine.add_exercise_full'))).toBeInTheDocument();
  });

  it('un día vacío de una plantilla es descanso, no un hueco por rellenar', () => {
    setup({ dayExercises: [], routine: routine({ isCustom: false }) });
    expect(screen.getByText(t('routine.rest_day'))).toBeInTheDocument();
    expect(screen.queryByText(t('routine.add_exercise_full'))).not.toBeInTheDocument();
  });

  it('un día liberado por la reorganización ofrece restaurar la semana', async () => {
    const user = userEvent.setup();
    const { props } = setup({ sourceDay: null, dayExercises: [] });

    expect(screen.getByText(t('routine.day_freed'))).toBeInTheDocument();
    await user.click(screen.getByText(t('routine.week_restore')));
    expect(props.onRestoreWeek).toHaveBeenCalled();
  });

  it('cuando la semana está movida cuenta de dónde viene el entreno', () => {
    setup({ selectedDay: 'friday', sourceDay: 'monday', movedFrom: 'monday' });
    expect(
      screen.getByText(t('routine.moved_from', { day: t('routine.days.monday') })),
    ).toBeInTheDocument();
  });
});
