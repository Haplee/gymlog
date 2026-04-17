import { create } from 'zustand';
import type { User, Subscription } from '@supabase/supabase-js';
import { supabase, SB_URL, SB_KEY } from '@shared/lib/supabase';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { queryClient } from '@app/queryClient';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  init: async () => {
    if (_authSubscription) {
      _authSubscription.unsubscribe();
      _authSubscription = null;
    }

    try {
      if (!SB_URL || !SB_KEY) {
        console.warn('[GymLog] Supabase no configurado');
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
      console.error('[GymLog] Error initializing auth:', err);
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    set({ user: data.user });
    return { error: null };
  },

  signUp: async (email, password, fullName, username) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return { error: new Error('Este email ya está registrado'), needsVerification: false };
      }
      return { error, needsVerification: false };
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        username,
      });
    }

    return { error: null, needsVerification: true };
  },

  signInWithGoogle: async () => {
    const isNative = Capacitor.isNativePlatform();
    const redirectTo = isNative
      ? 'com.franvi.gymlog://auth/callback'
      : `${window.location.origin}/auth/callback`;

    console.log('[GoogleAuth] isNative:', isNative, 'redirectTo:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: isNative,
      },
    });

    console.log('[GoogleAuth] OAuth result:', { data, error });

    if (error) {
      console.error('[GoogleAuth] Error:', error);
      throw error;
    }

    if (isNative && data?.url) {
      console.log('[GoogleAuth] Opening browser with URL:', data.url);
      await Browser.open({ url: data.url });
    }
  },

  signOut: async () => {
    // Limpieza de cache y estado persistido
    try {
      queryClient.clear();
      useWorkoutStore.getState().clearPersistedState();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[GymLog] Error durante signOut:', err);
    } finally {
      set({ user: null });
    }
  },
}));
