// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const authMocks = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<{ error: Error | null }>>(),
  signInWithPassword: vi.fn<
    (credentials: { email: string; password: string }) => Promise<{
      data: { user: User | null };
      error: Error | null;
    }>
  >(),
  signUp:
    vi.fn<
      (options: {
        email: string;
        password: string;
        options: { emailRedirectTo: string; data: Record<string, string> };
      }) => Promise<{ error: Error | null }>
    >(),
  signInWithOAuth: vi.fn<
    (options: { provider: string; options: Record<string, unknown> }) => Promise<{
      data: { url: string | null };
      error: Error | null;
    }>
  >(),
  getSession: vi.fn<
    () => Promise<{
      data: { session: { user: User } | null };
      error: Error | null;
    }>
  >(),
  onAuthStateChange: vi.fn<
    (callback: (event: string, session: { user: User } | null) => void) => {
      data: { subscription: { unsubscribe: () => void } };
    }
  >(),
}));

const cleanupMocks = vi.hoisted(() => ({
  adoptAccount: vi.fn<(userId: string | null) => Promise<void>>(),
  writeDataOwner: vi.fn<(userId: string | null) => void>(),
  clearLocalUserData:
    vi.fn<(options: { userId: string | null; clearOutbox: boolean }) => Promise<void>>(),
}));

const capacitorMock = vi.hoisted(() => ({
  isNativePlatform: vi.fn<() => boolean>(),
}));

const browserOpen = vi.hoisted(() => vi.fn<(options: { url: string }) => Promise<void>>());

// Registro compartido para poder afirmar el ORDEN de las operaciones, no solo
// que ocurrieron. El orden es lo que un refactor rompe sin que salte nada.
const calls: string[] = [];

vi.mock('@shared/lib/supabase', () => ({
  supabase: { auth: authMocks },
  SB_URL: 'https://test.supabase.co',
  SB_KEY: 'test-key',
}));

vi.mock('@app/userDataCleanup', () => cleanupMocks);

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

vi.mock('@capacitor/core', () => ({ Capacitor: capacitorMock }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: browserOpen } }));
vi.mock('@shared/lib/authErrors', () => ({ getAuthErrorMessage: (e: Error) => e.message }));
vi.mock('@shared/lib/devtools', () => ({
  devError: vi.fn(),
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

import { useAuthStore } from '../authStore';
// Efecto de importación: registra las tareas de signOut de routine y workout.
// En la app lo hace `main.tsx`; aquí se replica ese cableado porque authStore
// ya no conoce a esas features — esa es justo la dependencia que se invirtió.
import '@app/sessionTasks';
import { supabase } from '@shared/lib/supabase';
import { queryClient } from '@app/queryClient';

const USER = { id: 'user-123', email: 'user@example.com' } as User;
const OTHER_USER = { id: 'user-456', email: 'other@example.com' } as User;

let authStateHandler: ((event: string, session: { user: User } | null) => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  authStateHandler = null;

  authMocks.signOut.mockImplementation(async () => {
    calls.push('supabase.signOut');
    return { error: null };
  });
  authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  authMocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error: null });
  authMocks.signUp.mockResolvedValue({ error: null });
  authMocks.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
  authMocks.onAuthStateChange.mockImplementation((callback) => {
    authStateHandler = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  cleanupMocks.adoptAccount.mockResolvedValue(undefined);
  cleanupMocks.writeDataOwner.mockImplementation(() => undefined);
  cleanupMocks.clearLocalUserData.mockImplementation(async () => {
    calls.push('workout.clearPersistedState');
  });
  capacitorMock.isNativePlatform.mockReturnValue(false);
  browserOpen.mockResolvedValue(undefined);
  saveToDb.mockImplementation(async () => {
    calls.push('routine.saveToDb');
  });
});

describe('useAuthStore: ciclo de sesión', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, loading: true, initialized: false });
  });

  it('restaura la sesión guardada y adopta sus datos locales', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: { user: USER } }, error: null });

    await useAuthStore.getState().init();

    expect(useAuthStore.getState().user).toEqual(USER);
    expect(useAuthStore.getState().initialized).toBe(true);
    expect(useAuthStore.getState().loading).toBe(false);
    expect(cleanupMocks.adoptAccount).toHaveBeenCalledWith(USER.id);
  });

  it('inicializa sin sesión y registra el listener de cambios', async () => {
    await useAuthStore.getState().init();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().initialized).toBe(true);
    expect(authMocks.onAuthStateChange).toHaveBeenCalledOnce();
    expect(cleanupMocks.adoptAccount).toHaveBeenCalledWith(null);
  });

  it('aplica un token refrescado de la misma cuenta sin volver a limpiar', async () => {
    const refreshed = { ...USER, email: 'refreshed@example.com' } as User;
    authMocks.getSession.mockResolvedValue({ data: { session: { user: USER } }, error: null });
    await useAuthStore.getState().init();

    authStateHandler?.('TOKEN_REFRESHED', { user: refreshed });

    await vi.waitFor(() =>
      expect(useAuthStore.getState().user?.email).toBe('refreshed@example.com'),
    );
    expect(cleanupMocks.adoptAccount).toHaveBeenCalledTimes(1);
  });

  it('cambia de cuenta y limpia los datos de la cuenta anterior', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: { user: USER } }, error: null });
    await useAuthStore.getState().init();

    authStateHandler?.('SIGNED_IN', { user: OTHER_USER });

    await vi.waitFor(() => expect(useAuthStore.getState().user?.id).toBe(OTHER_USER.id));
    expect(cleanupMocks.adoptAccount).toHaveBeenLastCalledWith(OTHER_USER.id);
  });

  it('inicia sesión y adopta la cuenta antes de exponerla', async () => {
    authMocks.signInWithPassword.mockResolvedValue({ data: { user: USER }, error: null });

    const result = await useAuthStore.getState().signIn('user@example.com', 'contraseña-segura');

    expect(result).toEqual({ error: null });
    expect(useAuthStore.getState().user).toEqual(USER);
    expect(cleanupMocks.adoptAccount).toHaveBeenCalledWith(USER.id);
    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'contraseña-segura',
    });
  });

  it('devuelve un error traducible si las credenciales no son válidas', async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid login credentials'),
    });

    const result = await useAuthStore.getState().signIn('user@example.com', 'incorrecta');

    expect(result.error?.message).toBe('Invalid login credentials');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('registra una cuenta con la redirección y los metadatos de perfil', async () => {
    const result = await useAuthStore
      .getState()
      .signUp('new@example.com', 'contraseña-segura', 'Nueva', 'nueva');

    expect(result).toEqual({ error: null, needsVerification: true });
    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'contraseña-segura',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: 'Nueva', username: 'nueva' },
      },
    });
  });

  it('detecta un email ya registrado sin pedir verificación', async () => {
    authMocks.signUp.mockResolvedValue({ error: new Error('User already registered') });

    const result = await useAuthStore
      .getState()
      .signUp('new@example.com', 'contraseña-segura', 'Nueva', 'nueva');

    expect(result).toEqual({
      error: new Error('Este email ya está registrado'),
      needsVerification: false,
    });
  });

  it('propaga otros errores de registro sin marcar verificación', async () => {
    authMocks.signUp.mockResolvedValue({ error: new Error('Password too short') });

    const result = await useAuthStore
      .getState()
      .signUp('new@example.com', 'corta', 'Nueva', 'nueva');

    expect(result.error?.message).toBe('Password too short');
    expect(result.needsVerification).toBe(false);
  });

  it('usa el redirect web de Supabase sin abrir un navegador externo', async () => {
    await useAuthStore.getState().signInWithGoogle();

    expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false,
      },
    });
    expect(browserOpen).not.toHaveBeenCalled();
  });

  it('abre el navegador externo al autenticar con Google en Android', async () => {
    capacitorMock.isNativePlatform.mockReturnValue(true);
    authMocks.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://auth.example/google' },
      error: null,
    });

    await useAuthStore.getState().signInWithGoogle();

    expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'com.franvi.gymlog://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(browserOpen).toHaveBeenCalledWith({ url: 'https://auth.example/google' });
  });

  it('rechaza el inicio de sesión con Google cuando Supabase devuelve error', async () => {
    authMocks.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: new Error('oauth unavailable'),
    });

    await expect(useAuthStore.getState().signInWithGoogle()).rejects.toThrow('oauth unavailable');
  });
});

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

    expect(queryClient.clear).toHaveBeenCalled();
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

      expect(queryClient.clear).toHaveBeenCalled();
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
