import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// Registro compartido para poder afirmar el ORDEN de las operaciones, no solo
// que ocurrieron. El orden es lo que un refactor rompe sin que salte nada.
const calls: string[] = [];

vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(async () => {
        calls.push('supabase.signOut');
        return { error: null };
      }),
    },
  },
  SB_URL: 'https://test.supabase.co',
  SB_KEY: 'test-key',
}));

vi.mock('@app/queryClient', () => ({
  queryClient: {
    clear: vi.fn(() => {
      calls.push('queryClient.clear');
    }),
  },
}));

vi.mock('@features/workout/stores/workoutStore', () => ({
  useWorkoutStore: {
    getState: () => ({
      clearPersistedState: vi.fn(() => {
        calls.push('workout.clearPersistedState');
      }),
    }),
  },
}));

const saveToDb = vi.fn(async (_userId: string) => {
  calls.push('routine.saveToDb');
});

vi.mock('@features/routine/stores/routineStore', () => ({
  useRoutineStore: { getState: () => ({ saveToDb }) },
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn() } }));
vi.mock('@shared/lib/authErrors', () => ({ getAuthErrorMessage: (e: Error) => e.message }));
vi.mock('@shared/lib/devtools', () => ({
  devError: vi.fn(),
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

import { useAuthStore } from '../authStore';
import { supabase } from '@shared/lib/supabase';
import { queryClient } from '@app/queryClient';

const USER = { id: 'user-123' } as User;

/**
 * Tests de caracterización de `signOut`.
 *
 * Fijan el comportamiento ACTUAL antes de romper las dependencias circulares
 * entre authStore y las features workout/routine. No describen lo que el logout
 * debería hacer: describen lo que hace hoy, para que el refactor no lo cambie
 * por accidente.
 *
 * Lo importante: el backup de rutinas y el borrado del estado de workout NO son
 * la misma operación. El primero necesita credenciales válidas y se espera; el
 * segundo es un borrado síncrono. Cualquier rediseño que los trate igual rompe
 * el backup.
 */
describe('useAuthStore.signOut', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    saveToDb.mockImplementation(async () => {
      calls.push('routine.saveToDb');
    });
    useAuthStore.setState({ user: USER, loading: false, initialized: true });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('respalda las rutinas ANTES de cerrar la sesión en Supabase', async () => {
    await useAuthStore.getState().signOut();

    // El backup es el último momento con credenciales válidas: si se ejecuta
    // después del signOut, el guardado falla en silencio.
    expect(calls.indexOf('routine.saveToDb')).toBeLessThan(calls.indexOf('supabase.signOut'));
  });

  it('pasa el id del usuario al backup', async () => {
    await useAuthStore.getState().signOut();

    expect(saveToDb).toHaveBeenCalledWith(USER.id);
  });

  it('limpia la caché de queries y el estado persistido de workout', async () => {
    await useAuthStore.getState().signOut();

    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(calls).toContain('workout.clearPersistedState');
  });

  it('deja el usuario a null al terminar', async () => {
    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().user).toBeNull();
  });

  it('no intenta respaldar si no hay usuario en el store', async () => {
    useAuthStore.setState({ user: null });

    await useAuthStore.getState().signOut();

    expect(saveToDb).not.toHaveBeenCalled();
    expect(calls).toContain('supabase.signOut');
  });

  describe('cuando el backup de rutinas falla', () => {
    beforeEach(() => {
      saveToDb.mockImplementation(async () => {
        calls.push('routine.saveToDb:error');
        throw new Error('sin red');
      });
    });

    it('no bloquea el cierre de sesión', async () => {
      await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();

      expect(calls).toContain('supabase.signOut');
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('sigue limpiando la caché y el estado persistido', async () => {
      await useAuthStore.getState().signOut();

      expect(queryClient.clear).toHaveBeenCalledTimes(1);
      expect(calls).toContain('workout.clearPersistedState');
    });
  });

  describe('cuando Supabase falla al cerrar sesión', () => {
    it('deja igualmente el usuario a null', async () => {
      vi.mocked(supabase.auth.signOut).mockRejectedValueOnce(new Error('500'));

      await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();

      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
