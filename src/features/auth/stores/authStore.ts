import { create } from 'zustand';
import type { User, Subscription } from '@supabase/supabase-js';
import { supabase, SB_URL, SB_KEY } from '@shared/lib/supabase';
import { getAuthErrorMessage } from '@shared/lib/authErrors';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { queryClient } from '@app/queryClient';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { devError, devLog, devWarn } from '@shared/lib/devtools';

// Guardamos la subscripción fuera del store para que HMR y StrictMode
// no acumulen múltiples listeners de onAuthStateChange.
let _authSubscription: Subscription | null = null;

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
      set({ user: session?.user ?? null, loading: false, initialized: true });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null, loading: false });
      });

      _authSubscription = subscription;
    } catch (err) {
      devError('[GymLog] Error initializing auth:', err);
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    devLog('[Auth] signIn started for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      devError('[Auth] signIn error:', error.message, error.name);
      return { error: new Error(getAuthErrorMessage(error)) };
    }
    devLog('[Auth] signIn success, user:', data.user?.id);
    set({ user: data.user });
    return { error: null };
  },

  signUp: async (email, password, fullName, username) => {
    devLog('[Auth] signUp started for:', email);
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
    // Limpieza de cache y estado persistido
    try {
      // Backup de rutinas antes de cerrar sesión: es el último momento con
      // credenciales válidas y cubre el caso de storage limpiado entre ventanas
      // de checkAndBackup. Best-effort: un fallo no debe bloquear el logout.
      const userId = get().user?.id;
      if (userId) {
        await useRoutineStore
          .getState()
          .saveToDb(userId)
          .catch((e) => devError('[GymLog] Backup de rutinas en signOut falló:', e));
      }
      queryClient.clear();
      useWorkoutStore.getState().clearPersistedState();
      await supabase.auth.signOut();
    } catch (err) {
      devError('[GymLog] Error durante signOut:', err);
    } finally {
      set({ user: null });
    }
  },
}));
