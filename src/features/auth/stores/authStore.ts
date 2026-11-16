import { create } from 'zustand';
import type { User, Subscription } from '@supabase/supabase-js';
import { supabase, SB_URL, SB_KEY } from '@shared/lib/supabase';
import { getAuthErrorMessage } from '@shared/lib/authErrors';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { queryClient } from '@app/queryClient';
import { runSignOutPhase } from '@shared/lib/sessionLifecycle';
import { devError, devLog, devWarn } from '@shared/lib/devtools';

// Guardamos la subscripción fuera del store para que HMR y StrictMode
// no acumulen múltiples listeners de onAuthStateChange.
let _authSubscription: Subscription | null = null;

/**
 * Evita que el evento `SIGNED_OUT` de Supabase repita la limpieza que ya está
 * haciendo `signOut()`. El evento llega antes de que termine la función y, sin
 * esta marca, las tareas de cleanup correrían dos veces a la vez.
 */
let signOutInFlight = false;

/**
 * Aplica una identidad nueva con la garantía de que los datos locales de la
 * anterior no se muestran ni un fotograma.
 *
 * Los stores persistidos (rutinas, progresión, cardio…) no guardan a quién
 * pertenecen. Si el token caduca, lo revocan desde otro sitio o alguien entra
 * con otra cuenta sin pasar por `signOut`, la única forma segura de arrancar es
 * limpiar antes de exponer la sesión. `adoptAccount` compara con la marca de
 * dueño del dispositivo y se salta la limpieza cuando la cuenta es la misma.
 */
async function syncIdentity(nextUser: User | null): Promise<void> {
  const state = useAuthStore.getState();
  const previous = state.user;

  if (previous?.id === nextUser?.id) {
    useAuthStore.setState({ user: nextUser, loading: false });
    return;
  }

  // Se oculta la cuenta anterior mientras se limpia: dejar `previous` en
  // pantalla mientras corre el borrado enseña datos de otra persona.
  useAuthStore.setState({ user: null, loading: true });

  try {
    if (previous && !(nextUser === null && signOutInFlight)) {
      // La sesión ya cambió, así que `pre-signout` no puede escribir nada:
      // solo queda el borrado local.
      await runSignOutPhase('cleanup', previous.id);
    }

    const { adoptAccount, writeDataOwner } = await import('@app/userDataCleanup');
    if (nextUser) {
      await adoptAccount(nextUser.id);
    } else {
      writeDataOwner(null);
    }
  } catch (err) {
    // La limpieza es best-effort: si IndexedDB está bloqueado, se entra igual
    // (los stores ya se han reseteado en memoria) pero queda rastro.
    devError('[GymLog] Error limpiando datos al cambiar de cuenta:', err);
  }

  useAuthStore.setState({ user: nextUser, loading: false });
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    username: string,
  ) => Promise<{ error: Error | null; needsVerification: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

  init: async () => {
    devLog('[Auth] init started, SB_URL:', SB_URL ? 'configured' : 'MISSING');
    if (_authSubscription) {
      _authSubscription.unsubscribe();
      _authSubscription = null;
    }

    try {
      if (!SB_URL || !SB_KEY) {
        devWarn('[GymLog] Supabase no configurado');
        set({ user: null, loading: false, initialized: true });
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const initialUser = session?.user ?? null;
      // Antes de pintar nada: ¿estos datos locales son de esta cuenta?
      // Si el storage tiene datos de otra persona, se borran aquí.
      try {
        const { adoptAccount } = await import('@app/userDataCleanup');
        await adoptAccount(initialUser?.id ?? null);
      } catch (err) {
        devError('[GymLog] Error comprobando el dueño de los datos locales:', err);
      }
      set({ user: initialUser, loading: false, initialized: true });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        // `syncIdentity` es asíncrono y decide si hay que limpiar. No se puede
        // hacer trabajo pesado dentro del callback: Supabase lo ejecuta en el
        // hilo del evento y bloquearlo retrasa la propia sesión.
        void syncIdentity(session?.user ?? null);
      });

      _authSubscription = subscription;
    } catch (err) {
      devError('[GymLog] Error initializing auth:', err);
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    devLog('[Auth] signIn started');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Sin el correo en el log: basta con el nombre del error para depurar.
      devError('[Auth] signIn error:', error.name, error.message);
      return { error: new Error(getAuthErrorMessage(error)) };
    }
    if (data.user) {
      try {
        const { adoptAccount } = await import('@app/userDataCleanup');
        await adoptAccount(data.user.id);
      } catch (err) {
        devError('[GymLog] Error preparando los datos locales al entrar:', err);
      }
    }
    devLog('[Auth] signIn success');
    set({ user: data.user });
    return { error: null };
  },

  signUp: async (email, password, fullName, username) => {
    devLog('[Auth] signUp started');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // El trigger handle_new_user crea el perfil leyendo estos metadatos.
        // El INSERT directo a profiles que había aquí nunca funcionó: con
        // verificación por email no hay sesión todavía y RLS lo bloqueaba.
        data: { full_name: fullName, username },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return { error: new Error('Este email ya está registrado'), needsVerification: false };
      }
      return { error, needsVerification: false };
    }

    return { error: null, needsVerification: true };
  },

  signInWithGoogle: async () => {
    const isNative = Capacitor.isNativePlatform();
    const redirectTo = isNative
      ? 'com.franvi.gymlog://auth/callback'
      : `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: isNative,
      },
    });

    if (error) throw error;

    // Si estamos en nativo, abrimos el navegador manualmente con la URL que nos da Supabase
    if (isNative && data?.url) {
      await Browser.open({ url: data.url });
    }
  },

  signOut: async () => {
    // Las tareas de cada feature viven en el registro (`shared/lib/
    // sessionLifecycle`), no aquí: este store no debe conocer a workout ni a
    // routine. Quién las registra: `src/app/sessionTasks.ts`.
    signOutInFlight = true;
    try {
      const userId = get().user?.id ?? null;

      // Con la sesión aún viva: es el último momento con credenciales válidas.
      await runSignOutPhase('pre-signout', userId);

      queryClient.clear();
      await runSignOutPhase('cleanup', userId);

      // La marca de dueño se borra antes del signOut: si el borrado de la
      // sesión falla, el siguiente arranque no debe creer que los datos
      // (ya vaciados) siguen siendo de esta cuenta.
      try {
        const { writeDataOwner } = await import('@app/userDataCleanup');
        writeDataOwner(null);
      } catch (err) {
        devError('[GymLog] No se pudo borrar la marca de cuenta local:', err);
      }

      await supabase.auth.signOut();
    } catch (err) {
      devError('[GymLog] Error durante signOut:', err);
    } finally {
      signOutInFlight = false;
      set({ user: null });
    }
  },
}));
