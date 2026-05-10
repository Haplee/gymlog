import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@shared/lib/supabase';

export type CardioType =
  | 'running'
  | 'cycling'
  | 'rowing'
  | 'swimming'
  | 'elliptical'
  | 'walking'
  | 'jump_rope'
  | 'other';

export const CARDIO_LABELS: Record<CardioType, string> = {
  running: 'Correr',
  cycling: 'Bicicleta',
  rowing: 'Remo',
  swimming: 'Natación',
  elliptical: 'Elíptica',
  walking: 'Caminata',
  jump_rope: 'Cuerda',
  other: 'Otro',
};

export interface CardioSession {
  id: string;
  type: CardioType;
  startedAt: string;
  duration: number;
  distance?: number;
  calories?: number;
  notes?: string;
  pendingSync?: boolean;
}

interface CardioState {
  isActive: boolean;
  isPaused: boolean;
  activeType: CardioType | null;
  startedAt: string | null;
  pausedAt: string | null;
  pausedDuration: number;
  sessions: CardioSession[];

  startSession: (type: CardioType) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: (
    userId: string | null | undefined,
    extras?: {
      distance?: number;
      calories?: number;
      notes?: string;
    },
  ) => Promise<CardioSession | null>;
  discardSession: () => void;
  deleteSession: (id: string, userId?: string | null) => Promise<void>;
  syncFromRemote: (userId: string) => Promise<void>;
  getElapsed: () => number;
}

export const useCardioStore = create<CardioState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isPaused: false,
      activeType: null,
      startedAt: null,
      pausedAt: null,
      pausedDuration: 0,
      sessions: [],

      startSession: (type) => {
        set({
          isActive: true,
          isPaused: false,
          activeType: type,
          startedAt: new Date().toISOString(),
          pausedAt: null,
          pausedDuration: 0,
        });
      },

      pauseSession: () => {
        if (!get().isActive || get().isPaused) return;
        set({ isPaused: true, pausedAt: new Date().toISOString() });
      },

      resumeSession: () => {
        const { isPaused, pausedAt, pausedDuration } = get();
        if (!isPaused || !pausedAt) return;
        const extra = Math.floor((Date.now() - new Date(pausedAt).getTime()) / 1000);
        set({ isPaused: false, pausedAt: null, pausedDuration: pausedDuration + extra });
      },

      stopSession: async (userId, extras = {}) => {
        const { isActive, activeType, startedAt } = get();
        if (!isActive || !activeType || !startedAt) return null;

        const elapsed = get().getElapsed();
        if (elapsed < 5) {
          get().discardSession();
          return null;
        }

        const session: CardioSession = {
          id: crypto.randomUUID(),
          type: activeType,
          startedAt,
          duration: elapsed,
          ...extras,
        };

        if (userId) {
          const { data, error } = await supabase
            .from('cardio_sessions')
            .insert({
              user_id: userId,
              type: session.type,
              started_at: session.startedAt,
              duration: session.duration,
              distance: session.distance ?? null,
              calories: session.calories ?? null,
              notes: session.notes ?? null,
            })
            .select('id')
            .single();
          if (!error && data?.id) {
            session.id = data.id;
            session.pendingSync = false;
          } else {
            session.pendingSync = true;
            if (error) console.error('[CardioStore] insert failed:', error.message);
          }
        } else {
          session.pendingSync = true;
        }

        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, 100),
          isActive: false,
          isPaused: false,
          activeType: null,
          startedAt: null,
          pausedAt: null,
          pausedDuration: 0,
        }));

        return session;
      },

      discardSession: () => {
        set({
          isActive: false,
          isPaused: false,
          activeType: null,
          startedAt: null,
          pausedAt: null,
          pausedDuration: 0,
        });
      },

      deleteSession: async (id, userId) => {
        set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
        if (userId) {
          const { error } = await supabase.from('cardio_sessions').delete().eq('id', id);
          if (error) console.error('[CardioStore] delete failed:', error.message);
        }
      },

      syncFromRemote: async (userId) => {
        const { data, error } = await supabase
          .from('cardio_sessions')
          .select('id, type, started_at, duration, distance, calories, notes')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(200);
        if (error) {
          console.error('[CardioStore] syncFromRemote failed:', error.message);
          return;
        }
        const remote: CardioSession[] = (data || []).map((r) => ({
          id: r.id,
          type: r.type as CardioType,
          startedAt: r.started_at,
          duration: r.duration,
          distance: r.distance ?? undefined,
          calories: r.calories ?? undefined,
          notes: r.notes ?? undefined,
          pendingSync: false,
        }));

        // Push pending or unknown local sessions
        const remoteStartedSet = new Set(remote.map((r) => r.startedAt));
        const pending = get().sessions.filter(
          (s) =>
            s.pendingSync ||
            (!remote.some((r) => r.id === s.id) && !remoteStartedSet.has(s.startedAt)),
        );
        const stillPending: CardioSession[] = [];
        if (pending.length > 0) {
          const { data: inserted, error: pushErr } = await supabase
            .from('cardio_sessions')
            .insert(
              pending.map((s) => ({
                user_id: userId,
                type: s.type,
                started_at: s.startedAt,
                duration: s.duration,
                distance: s.distance ?? null,
                calories: s.calories ?? null,
                notes: s.notes ?? null,
              })),
            )
            .select('id, type, started_at, duration, distance, calories, notes');
          if (!pushErr && inserted && inserted.length > 0) {
            inserted.forEach((r) =>
              remote.unshift({
                id: r.id,
                type: r.type as CardioType,
                startedAt: r.started_at,
                duration: r.duration,
                distance: r.distance ?? undefined,
                calories: r.calories ?? undefined,
                notes: r.notes ?? undefined,
                pendingSync: false,
              }),
            );
          } else {
            // Keep pending sessions for next retry
            pending.forEach((p) => stillPending.push({ ...p, pendingSync: true }));
            if (pushErr) console.error('[CardioStore] push pending failed:', pushErr.message);
            else if (!inserted || inserted.length === 0)
              console.warn('[CardioStore] push returned no rows — keeping sessions as pending');
          }
        }

        const merged = [...stillPending, ...remote];
        merged.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        set({ sessions: merged });
      },

      getElapsed: () => {
        const { startedAt, pausedAt, pausedDuration, isPaused } = get();
        if (!startedAt) return 0;
        const total = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
        const paused =
          isPaused && pausedAt
            ? pausedDuration + Math.floor((Date.now() - new Date(pausedAt).getTime()) / 1000)
            : pausedDuration;
        return Math.max(0, total - paused);
      },
    }),
    {
      name: 'gymlog-cardio',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        isActive: s.isActive,
        isPaused: s.isPaused,
        activeType: s.activeType,
        startedAt: s.startedAt,
        pausedAt: s.pausedAt,
        pausedDuration: s.pausedDuration,
        sessions: s.sessions,
      }),
    },
  ),
);
