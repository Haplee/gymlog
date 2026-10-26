// Orquestación (con IO Supabase) del import Excel: persiste fuerza y cardio.
// Las rutinas se devuelven parseadas y las guarda la página vía routineStore.

import { supabase } from '@shared/lib/supabase';
import { devError } from '@shared/lib/devtools';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { fetchExercises } from '@shared/api/queries';
import { retryOnNetwork } from '@shared/lib/idempotency';
import { CARDIO_LABELS, type CardioType } from '@features/cardio/stores/cardioStore';
import { makeDedupKey } from './exportImport';
import { deriveImportKey, newImportId } from './importIdentity';
import type { ParsedImport } from './excelImport';

export interface ExcelImportResult {
  sets: number;
  cardio: number;
  /** Series que coincidian con (fecha, ejercicio, set_num) y no se importaron. */
  skipped: number;
  /** Lotes de fuerza o sesiones de cardio que no se pudieron guardar. */
  failed: number;
  /**
   * Claves de las series que sí se guardaron. El hook las acumula para que una
   * segunda importación seguida no dependa de que el refetch ya haya llegado.
   */
  importedKeys: string[];
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

/** Serie de fuerza ya resuelta, con su ejercicio, lista para la RPC. */
interface StrengthSetPayload {
  exercise_id: string;
  set_num: number;
  reps: number;
  weight: number;
}

/** Inserta en BD los datos parseados del Excel (fuerza + cardio). */
export async function applyExcelImport(
  userId: string,
  parsed: ParsedImport,
  existingKeys?: Set<string>,
  importId: string = newImportId(),
): Promise<ExcelImportResult> {
  let setsImported = 0;
  let cardioImported = 0;
  let skipped = 0;
  let failed = 0;
  const dedupeKeys = existingKeys ? new Set(existingKeys) : null;
  const importedKeys: string[] = [];

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

  const setCounters = new Map<string, number>();
  // Un día = un entreno = una transacción. Antes cada serie era un INSERT
  // suelto: perder la respuesta a mitad dejaba el día incompleto y un reintento
  // duplicaba lo ya escrito. Agrupado, o entra el día entero o no entra nada.
  const setsByDate = new Map<string, StrengthSetPayload[]>();
  const keysByDate = new Map<string, string[]>();

  for (const row of parsed.strength) {
    // El contador de series va por (fecha, ejercicio) **antes** de descartar
    // duplicados, para que el set_num de una fila no dependa de si la anterior
    // ya existía. Es la misma cuenta que hace `estimateDedupSkips` al previsualizar.
    const counterKey = `${row.date}|${row.exercise.trim().toLowerCase()}`;
    const setNum = (setCounters.get(counterKey) ?? 0) + 1;
    setCounters.set(counterKey, setNum);

    const importedKey = makeDedupKey(row.date, row.exercise, setNum);
    if (dedupeKeys) {
      if (dedupeKeys.has(importedKey)) {
        skipped++;
        continue;
      }
      dedupeKeys.add(importedKey);
    }

    // El ejercicio se resuelve aquí, pero el entreno no se crea hasta tener
    // todas las series del día: un fichero cuyas filas son todas duplicadas no
    // deja un entreno vacío.
    const exerciseId = await resolveExerciseId(row.exercise);
    if (!exerciseId) continue;

    const daySets = setsByDate.get(row.date) ?? [];
    daySets.push({
      exercise_id: exerciseId,
      set_num: setNum,
      reps: row.reps,
      weight: row.weight,
    });
    setsByDate.set(row.date, daySets);

    const dayKeys = keysByDate.get(row.date) ?? [];
    dayKeys.push(importedKey);
    keysByDate.set(row.date, dayKeys);
  }

  for (const [date, daySets] of setsByDate) {
    // La clave identifica el día de esta importación. Se deriva del id de la
    // importación, que se crea ANTES del primer intento y no cambia entre
    // reintentos de red: si el lote llegó a entrar y solo se perdió la
    // respuesta, el reintento devuelve el mismo entreno en vez de duplicarlo.
    // Una importación manual nueva usa otro id y, por tanto, otra clave.
    const clientId = deriveImportKey(importId, `workout:${date}`);
    try {
      await retryOnNetwork(async () => {
        const { error } = await supabase.rpc('save_workout_with_sets', {
          p_user_id: userId,
          p_exercise_id: null,
          p_started_at: date,
          p_finished_at: null,
          p_sets: daySets,
          p_notes: null,
          p_rating: null,
          p_client_id: clientId,
        });
        if (error) throw error;
      });
      setsImported += daySets.length;
      importedKeys.push(...(keysByDate.get(date) ?? []));
    } catch (err) {
      // Un día que falla no impide importar los demás; sus claves no se dan por
      // guardadas para que un reintento vuelva a intentarlo.
      failed++;
      devError(`[applyExcelImport] fallo guardando el ${date}:`, err);
    }
  }

  // --- Cardio ---
  // Misma garantía que la fuerza: la clave se deriva de la importación y se
  // conserva durante los reintentos de red. La RPC devuelve la sesión original
  // si la escritura anterior llegó al servidor y solo se perdió la respuesta.
  let cardioIndex = 0;
  for (const c of parsed.cardio) {
    const clientId = deriveImportKey(importId, `cardio:${cardioIndex++}:${c.date}:${c.typeLabel}`);
    try {
      await retryOnNetwork(async () => {
        const { error } = await supabase.rpc('save_cardio_session', {
          p_user_id: userId,
          p_client_id: clientId,
          p_type: resolveCardioType(c.typeLabel),
          p_started_at: c.date,
          p_duration: Math.round(c.durationMin * 60),
          p_distance: c.distanceKm,
          p_calories: c.calories,
          p_notes: c.notes,
        });
        if (error) throw error;
      });
      cardioImported++;
    } catch (err) {
      failed++;
      devError(`[applyExcelImport] fallo guardando cardio del ${c.date}:`, err);
    }
  }

  return { sets: setsImported, cardio: cardioImported, skipped, failed, importedKeys };
}
