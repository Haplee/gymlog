import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  stopSession: (extras?: {
    distance?: number;
    calories?: number;
    notes?: string;
  }) => CardioSession | null;
  discardSession: () => void;
  deleteSession: (id: string) => void;
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

      stopSession: (extras = {}) => {
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

      deleteSession: (id) => {
        set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
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
