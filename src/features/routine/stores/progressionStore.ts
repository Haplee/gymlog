import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@shared/lib/supabase';
import { devError } from '@shared/lib/devtools';
import {
  advanceProgression,
  createInitialProgression,
  deriveProgressionEvent,
  normalizeExerciseName,
  suggestedPrefillWeight,
  DEFAULT_DELOAD_CYCLE_LENGTH,
  type ProgressionConfig,
  type ProgressionSessionOutcome,
  type ProgressionState,
} from '@shared/lib/progressionCycle';

export interface ProgressionLogEntry {
  id: string;
  exerciseName: string;
  event: string;
  fromWeight: number | null;
  toWeight: number | null;
  reps: number | null;
  createdAt: string;
}

interface ProgressionStore {
  /** Estado por ejercicio, indexado por nombre normalizado. */
  entries: Record<string, ProgressionState>;
  /** Eventos aún sin subir a `progression_log`. */
  pendingLogs: ProgressionLogEntry[];
  /** Si ya se ha leído la BD en esta sesión (misma regla que routineStore). */
  hydrated: boolean;
  loading: boolean;

  getState: (name: string) => ProgressionState | null;
  /** Peso (kg) a precargar en la próxima sesión del ejercicio. */
  prefillWeightFor: (name: string, lastTopWeight: number | null) => number | null;
  /**
   * Registra una sesión y avanza el ciclo del ejercicio. Crea el estado si es
   * la primera vez que se ve. Devuelve el estado resultante o `null` si la
   * mejor serie no es válida.
   */
  recordSession: (
    name: string,
    outcome: ProgressionSessionOutcome,
    config?: ProgressionConfig,
  ) => ProgressionState | null;
  /** Fuerza manualmente el inicio/fin de una semana de descarga. */
  setDeload: (name: string, enabled: boolean) => void;
  loadFromDb: (userId: string) => Promise<void>;
  saveToDb: (userId: string) => Promise<boolean>;
  reset: () => void;
}

function roundKg(n: number | null): number | null {
  if (n === null) return null;
  return Math.round(n * 100) / 100;
}

function rowToState(row: Record<string, unknown>): ProgressionState {
  return {
    exerciseName: String(row.exercise_name ?? ''),
    repMin: row.rep_min != null ? Number(row.rep_min) : undefined,
    repMax: row.rep_max != null ? Number(row.rep_max) : undefined,
    incrementKg: Number(row.increment_kg ?? 2.5),
    bodyweight: Boolean(row.bodyweight),
    currentWeight: row.current_weight != null ? Number(row.current_weight) : undefined,
    currentReps: row.current_reps != null ? Number(row.current_reps) : undefined,
    sessionCount: Number(row.session_count ?? 0),
    nextDeloadWeek: Number(row.next_deload_week ?? DEFAULT_DELOAD_CYCLE_LENGTH - 1),
    isDeloadWeek: Boolean(row.is_deload_week),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export const useProgressionStore = create<ProgressionStore>()(
  persist(
    (set, get) => ({
      entries: {},
      pendingLogs: [],
      hydrated: false,
      loading: false,

      getState: (name) => get().entries[normalizeExerciseName(name)] ?? null,

      prefillWeightFor: (name, lastTopWeight) => {
        const state = get().entries[normalizeExerciseName(name)] ?? null;
        return suggestedPrefillWeight(state, lastTopWeight);
      },

      recordSession: (name, outcome, config = {}) => {
        if (
          !Number.isFinite(outcome.weight) ||
          !Number.isFinite(outcome.reps) ||
          outcome.reps <= 0
        ) {
          return null;
        }
        const key = normalizeExerciseName(name);
        const { entries } = get();
        const existing = entries[key];
        const prev =
          existing ??
          createInitialProgression(name, outcome, {
            repMin: config.repMin,
            repMax: config.repMax,
            incrementKg: config.incrementKg,
            bodyweight: config.bodyweight,
            cycleLength: config.cycleLength,
          });
        const next = advanceProgression(prev, outcome, config);
        const event = existing ? deriveProgressionEvent(prev, next) : 'seed';
        const log: ProgressionLogEntry = {
          id: crypto.randomUUID(),
          exerciseName: name,
          event: event ?? 'seed',
          fromWeight: roundKg(prev.currentWeight ?? null),
          toWeight: roundKg(next.currentWeight ?? null),
          reps: next.currentReps ?? null,
          createdAt: new Date().toISOString(),
        };
        set({ entries: { ...entries, [key]: next }, pendingLogs: [...get().pendingLogs, log] });
        return next;
      },

      setDeload: (name, enabled) => {
        const key = normalizeExerciseName(name);
        const { entries } = get();
        const current = entries[key];
        if (!current) return;
        set({
          entries: {
            ...entries,
            [key]: {
              ...current,
              isDeloadWeek: enabled,
              nextDeloadWeek: enabled ? 0 : current.nextDeloadWeek,
              updatedAt: new Date().toISOString(),
            },
          },
        });
      },

      loadFromDb: async (userId: string) => {
        set({ loading: true });
        const { data, error } = await supabase
          .from('exercise_progression')
          .select('*')
          .eq('user_id', userId);

        if (!error && data) {
          const remote: Record<string, ProgressionState> = {};
          for (const row of data) {
            const state = rowToState(row as Record<string, unknown>);
            if (!state.exerciseName) continue;
            remote[normalizeExerciseName(state.exerciseName)] = state;
          }
          // Merge: lo remoto manda sobre lo local, pero los ejercicios locales
          // que la BD aún no conoce se conservan (offline / guardado fallido).
          set({
            entries: { ...get().entries, ...remote },
            loading: false,
            hydrated: true,
          });
          return;
        }

        set({ loading: false, hydrated: !error ? true : get().hydrated });
      },

      saveToDb: async (userId: string) => {
        // Nunca escribir sin haber leído antes (misma regla que routineStore):
        // un estado local vacío no puede pisar la nube de un usuario con historia.
        if (!get().hydrated) await get().loadFromDb(userId);

        const { entries, pendingLogs } = get();
        const rows = Object.values(entries);
        if (rows.length === 0) return true;

        const payload = rows.map((e) => ({
          user_id: userId,
          exercise_name: e.exerciseName,
          rep_min: e.repMin ?? null,
          rep_max: e.repMax ?? null,
          increment_kg: e.incrementKg,
          bodyweight: e.bodyweight,
          current_weight: roundKg(e.currentWeight ?? null),
          current_reps: e.currentReps ?? null,
          session_count: e.sessionCount,
          next_deload_week: e.nextDeloadWeek,
          is_deload_week: e.isDeloadWeek,
        }));

        const { error } = await supabase
          .from('exercise_progression')
          .upsert(payload, { onConflict: 'user_id,exercise_name' });
        if (error) {
          devError('Error saving progression:', error);
          return false;
        }

        if (pendingLogs.length > 0) {
          const logPayload = pendingLogs.map((l) => ({
            user_id: userId,
            exercise_name: l.exerciseName,
            event: l.event,
            from_weight: l.fromWeight,
            to_weight: l.toWeight,
            reps: l.reps,
          }));
          const { error: logError } = await supabase.from('progression_log').insert(logPayload);
          if (logError) {
            devError('Error saving progression log:', logError);
          } else {
            set({ pendingLogs: [] });
          }
        }
        return true;
      },

      reset: () => set({ entries: {}, pendingLogs: [], hydrated: false }),
    }),
    {
      name: 'gymlog-progression',
      partialize: (state) => ({
        entries: state.entries,
        pendingLogs: state.pendingLogs,
      }),
    },
  ),
);
