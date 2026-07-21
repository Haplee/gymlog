// Orquestación (con IO Supabase) del import Excel: persiste fuerza y cardio.
// Las rutinas se devuelven parseadas y las guarda la página vía routineStore.

import { supabase } from '@shared/lib/supabase';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { fetchExercises } from '@shared/api/queries';
import { CARDIO_LABELS, type CardioType } from '@features/cardio/stores/cardioStore';
import type { ParsedImport } from './excelImport';

export interface ExcelImportResult {
  sets: number;
  cardio: number;
}

const TYPE_BY_LABEL = new Map<string, CardioType>(
  (Object.entries(CARDIO_LABELS) as [CardioType, string][]).map(([type, label]) => [
    label.toLowerCase(),
    type,
  ]),
);

function resolveCardioType(label: string): CardioType {
  return TYPE_BY_LABEL.get(label.trim().toLowerCase()) ?? 'other';
}

/** Inserta en BD los datos parseados del Excel (fuerza + cardio). */
export async function applyExcelImport(
  userId: string,
  parsed: ParsedImport,
): Promise<ExcelImportResult> {
  let setsImported = 0;
  let cardioImported = 0;

  // --- Fuerza ---
  const exerciseList = await fetchExercises(userId);
  const idByName = new Map<string, string>();
  for (const ex of exerciseList) {
    if (ex?.name && ex.id) idByName.set(ex.name.toLowerCase(), ex.id);
  }

  const resolveExerciseId = async (name: string): Promise<string | null> => {
    const clean = name.trim();
    if (clean.length < 2) return null;
    const existing = idByName.get(clean.toLowerCase());
    if (existing) return existing;
    const { data: newEx, error } = await supabase
      .from('exercises')
      .insert({ name: clean, user_id: userId, muscle_group: DEFAULT_MUSCLE_GROUP })
      .select('id')
      .single();
    if (error || !newEx) return null;
    idByName.set(clean.toLowerCase(), newEx.id);
    return newEx.id;
  };

  const workoutIdByDate = new Map<string, string>();
  const setCounters = new Map<string, number>();

  for (const row of parsed.strength) {
    let workoutId = workoutIdByDate.get(row.date);
    if (!workoutId) {
      const { data, error } = await supabase
        .from('workouts')
        .insert({ user_id: userId, started_at: row.date })
        .select('id')
        .single();
      if (error || !data?.id) continue;
      workoutId = data.id;
      workoutIdByDate.set(row.date, data.id);
    }
    if (!workoutId) continue;

    const exerciseId = await resolveExerciseId(row.exercise);
    if (!exerciseId) continue;

    const counterKey = `${row.date}_${exerciseId}`;
    const setNum = (setCounters.get(counterKey) ?? 0) + 1;
    setCounters.set(counterKey, setNum);

    const { error: insertError } = await supabase.from('workout_sets').insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      weight: row.weight,
      reps: row.reps,
      set_num: setNum,
    });
    if (!insertError) setsImported++;
  }

  // --- Cardio ---
  for (const c of parsed.cardio) {
    const { error } = await supabase.from('cardio_sessions').insert({
      user_id: userId,
      type: resolveCardioType(c.typeLabel),
      started_at: c.date,
      duration: Math.round(c.durationMin * 60),
      distance: c.distanceKm,
      calories: c.calories,
      notes: c.notes,
    });
    if (!error) cardioImported++;
  }

  return { sets: setsImported, cardio: cardioImported };
}
