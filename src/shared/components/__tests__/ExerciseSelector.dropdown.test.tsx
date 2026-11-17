// @vitest-environment jsdom
/**
 * El desplegable de ejercicios tiene que quedar **acotado a la pantalla**.
 *
 * Es lo que se rompió: cuelga del buscador en `position: absolute`, así que no
 * empuja al documento, y con un tope fijo de `60rem` (960 px, más que cualquier
 * móvil) se salía por debajo del viewport. El `overflow-y-auto` interno no
 * llegaba a activarse y no había forma de alcanzar los últimos ejercicios: ni
 * desplazando la lista ni la página.
 *
 * Aquí se comprueba el invariante, no la maqueta: que el alto máximo se calcula
 * contra la pantalla y no es un número fijo. El desplazamiento real no se puede
 * probar en jsdom —no hay layout ni gestos— y se verificó a mano en la APK.
 *
 * **Lo que este fichero NO prueba, y conviene saberlo:** había un
 * `preventDefault()` en `touchstart` que parecía apagar el scroll táctil. No lo
 * apagaba: React registra `touchstart` como listener **pasivo**, y ahí el
 * navegador ignora `preventDefault()`. Se quitó por ser código muerto y
 * engañoso, pero no era el fallo. Se comprobó reintroduciéndolo y viendo que la
 * lista seguía desplazándose igual en el dispositivo. Un test sobre eso daba
 * tranquilidad sin comprobar nada, así que no está.
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { ExerciseSelector } from '../ExerciseSelector';

const mocks = vi.hoisted(() => ({
  fetchExercises: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@shared/lib/supabase', () => ({ supabase: { from: vi.fn() } }));

vi.mock('@shared/api/queries', () => ({
  fetchExercises: mocks.fetchExercises,
}));

type SelectHandler = (exerciseId: string, isCustom: boolean) => void;

function montar(
  defaultOpen: boolean,
  onSelect: SelectHandler = vi.fn(),
  extra: { activeExerciseId?: string; excludeIds?: string[] } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <ExerciseSelector
        userId="u1"
        onSelect={onSelect}
        defaultOpen={defaultOpen}
        activeExerciseId={extra.activeExerciseId}
        excludeIds={extra.excludeIds}
      />
    </QueryClientProvider>,
  );
  return { ...result, onSelect };
}

beforeEach(() => {
  mocks.fetchExercises.mockReset();
  mocks.fetchExercises.mockResolvedValue([
    { id: '1', name: 'Press banca', muscle_group: 'Pecho', is_public: true, user_id: null },
    { id: '2', name: 'Sentadilla', muscle_group: 'Pierna', is_public: true, user_id: null },
    {
      id: '3',
      name: 'Press militar',
      muscle_group: 'Hombro',
      is_public: false,
      user_id: 'u1',
    },
  ]);
});

afterEach(cleanup);

describe('ExerciseSelector — el desplegable no se sale de la pantalla', () => {
  it('la lista puede desplazarse por dentro', async () => {
    montar(true);
    const lista = await screen.findByRole('listbox');

    // Sin esto el alto máximo no serviría de nada: recortaría el contenido en
    // vez de dejar llegar al final.
    expect(lista.className).toMatch(/overflow-y-auto/);
  });

  it('el colgante acota el alto contra el viewport, no con un número fijo', async () => {
    // `defaultOpen: false` es la variante de la pantalla de inicio, donde el
    // desplegable va en `absolute` y estaba el fallo.
    montar(false);
    act(() => screen.getByLabelText('search.placeholder').focus());

    const lista = await screen.findByRole('listbox');
    // El alto se aplica tras el layout (`requestAnimationFrame`), no en el
    // mismo render: leerlo de inmediato lo pilla todavía sin poner.
    await waitFor(() => expect(lista.style.maxHeight).toBeTruthy());
    const alto = lista.style.maxHeight;

    // `100dvh` es lo que encoge el teclado en Android y `env(...)` la franja de
    // gestos: las dos cosas que un valor fijo en `rem` no puede saber.
    expect(alto).toContain('100dvh');
    expect(alto).toContain('env(safe-area-inset-bottom)');
    expect(alto).not.toMatch(/^\s*\d+(\.\d+)?rem\s*$/);
  });

  it('descuenta la barra inferior, que va fija encima del contenido', async () => {
    montar(false);
    act(() => screen.getByLabelText('search.placeholder').focus());

    const lista = await screen.findByRole('listbox');

    // Sin este término la última fila («crear ejercicio propio») quedaba tapada
    // por la barra: se vio así en la APK antes de corregirlo.
    await waitFor(() => expect(lista.style.maxHeight).toContain('--bottom-nav-height'));
  });
});

describe('ExerciseSelector — interacción', () => {
  it('selecciona un ejercicio público y notifica que no es propio', async () => {
    const onSelect = vi.fn();
    montar(true, onSelect);

    fireEvent.click(await screen.findByRole('option', { name: 'Press banca' }));

    expect(onSelect).toHaveBeenCalledWith('1', false);
  });

  it('selecciona un ejercicio propio y lo registra como reciente', async () => {
    const onSelect = vi.fn();
    montar(true, onSelect);

    fireEvent.click(await screen.findByRole('option', { name: /Press militar/ }));

    expect(onSelect).toHaveBeenCalledWith('3', true);
    expect(JSON.parse(localStorage.getItem('gymlog-recent-exercises') ?? '[]')).toEqual(['3']);
  });

  it('filtra los ejercicios con el texto de búsqueda', async () => {
    montar(true);
    const input = screen.getByLabelText('search.placeholder');

    fireEvent.change(input, { target: { value: 'sentadilla' } });

    await waitFor(
      () => {
        expect(screen.getByRole('option', { name: 'Sentadilla' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Press banca' })).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('abre el editor del grupo muscular para un ejercicio propio', async () => {
    montar(true);

    fireEvent.click(await screen.findByRole('button', { name: 'library.edit_muscle_group' }));

    expect(screen.getByText('Guardar grupo muscular')).toBeInTheDocument();
  });

  it('cierra el desplegable con Escape y devuelve el foco al cuerpo', async () => {
    montar(false);
    const input = screen.getByLabelText('search.placeholder');
    act(() => input.focus());
    await screen.findByRole('listbox');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).not.toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it('cierra el desplegable al pulsar fuera', async () => {
    const { container } = montar(false);
    const input = screen.getByLabelText('search.placeholder');
    act(() => input.focus());
    await screen.findByRole('listbox');
    const backdrop = container.querySelector('div.fixed.inset-0.z-40');
    expect(backdrop).not.toBeNull();

    fireEvent.click(backdrop as Element);

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });
});
