import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useAuthStore } from '@features/auth/stores/authStore';
import {
  useRoutineStore,
  type DayOfWeek,
  type DayRoutine,
} from '@features/routine/stores/routineStore';
import { useCardioStore, CARDIO_LABELS } from '@features/cardio/stores/cardioStore';
import { supabase } from '@shared/lib/supabase';
import { devError } from '@shared/lib/devtools';
import { fetchExercises } from '@shared/api/queries';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import type { WorkoutWithSets } from '@shared/lib/types';
import {
  tokenizeCsvLine,
  parseImportNumber as parseNumber,
  parseImportDate as parseDate,
  isHeaderLine,
  buildExportJson,
  buildExistingDedupKeys,
  estimateDedupSkips,
  makeDedupKey,
  type DedupCandidate,
} from '../utils/exportImport';
import {
  exportAllToXlsx,
  arrayBufferToBase64,
  type ExcelStrengthSet,
  type ExcelCardioRow,
  type ExcelRoutineRow,
} from '../utils/excelExport';
import { parseXlsxFile, DAY_LABELS, type ParsedImport } from '../utils/excelImport';
import { parseImportedWorkouts } from '../utils/importSchema';
import {
  parseTrackerCsv,
  TrackerFormatError,
  TRACKER_NAME,
  type TrackerId,
} from '../utils/importTrackers';
import { applyExcelImport } from '../utils/applyExcelImport';

/**
 * Exportacion e importacion del historial (XLSX, JSON y CSV).
 *
 * Vivia dentro de HistoryPage, que con esto pasa de 1380 a ~920 lineas. Se ha
 * movido tal cual: mismos formatos aceptados, mismo orden de operaciones,
 * mismos mensajes. No es una reescritura, es un traslado.
 *
 * Los datos que dependen de queries (`workouts` y los dos `refetch`) entran por
 * parametro porque son de la pagina; lo que vive en stores (usuario, rutinas,
 * cardio) lo lee el hook directamente.
 *
 * Importar no persiste al seleccionar el archivo: se parsea, se cuentan lo que
 * se va a importar (entrenos/series/cardio/rutinas) y cuantas series ya existen
 * por (fecha, ejercicio, set_num), y se abre un dialogo de confirmacion. Solo al
 * confirmar se inserta, saltandose las series duplicadas.
 */
type PendingImport =
  | {
      kind: 'json';
      workouts: unknown[];
      /** App de origen, cuando el fichero venía de otro tracker. */
      tracker?: TrackerId;
      /** Filas que el tracker no supo importar (cardio, sobre todo). */
      skippedRows?: number;
    }
  | { kind: 'excel'; parsed: ParsedImport };

/** Conteo de lo que entraria al confirmar un import pendiente. */
interface ImportSummary {
  workouts: number;
  sets: number;
  cardio: number;
  routines: number;
  /** Series que ya existen (fecha, ejercicio, set_num) y se saltarian. */
  skips: number;
}

/** Resumen de un JSON pendiente: entrenos, series y duplicadas ya existentes. */
function previewJsonImport(importedWorkouts: unknown, existingKeys: Set<string>): ImportSummary {
  const { workouts } = parseImportedWorkouts(importedWorkouts);

  let setsCount = 0;
  const candidates: DedupCandidate[] = [];
  for (const workout of workouts) {
    for (const [exercise, sets] of workout.byExercise) {
      sets.forEach((s, i) => {
        setsCount++;
        candidates.push({ date: workout.date, exercise, setNum: s.set_num ?? i + 1 });
      });
    }
  }

  return {
    workouts: workouts.length,
    sets: setsCount,
    cardio: 0,
    routines: 0,
    skips: estimateDedupSkips(candidates, existingKeys),
  };
}

export function useHistoryTransfer({
  workouts,
  refetchSets,
  refetchWorkouts,
}: {
  workouts: WorkoutWithSets[];
  refetchSets: () => Promise<unknown>;
  refetchWorkouts: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const routines = useRoutineStore((s) => s.routines);
  const addRoutine = useRoutineStore((s) => s.addRoutine);
  const saveRoutinesToDb = useRoutineStore((s) => s.saveToDb);
  const cardioSessions = useCardioStore((s) => s.sessions);
  const syncCardio = useCardioStore((s) => s.syncFromRemote);

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const existingKeys = useMemo(() => buildExistingDedupKeys(workouts), [workouts]);

  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const saveXlsx = async (fileName: string, buffer: ArrayBuffer) => {
    if (Capacitor.isNativePlatform()) {
      // Sin `encoding`: Filesystem interpreta data como base64 (fichero binario).
      await Filesystem.writeFile({
        path: fileName,
        data: arrayBufferToBase64(buffer),
        directory: Directory.Cache,
      });
      const uriResult = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
      await Share.share({
        title: t('history.export_share_title'),
        url: uriResult.uri,
        dialogTitle: t('history.export_share_dialog'),
      });
    } else {
      const blob = new Blob([buffer], { type: XLSX_MIME });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    }
  };

  const exportToExcel = async () => {
    const fileName = `gymlog_${new Date().toISOString().split('T')[0]}.xlsx`;
    try {
      const strength: ExcelStrengthSet[] = workouts.flatMap((w) => {
        const date = w.started_at ? w.started_at.split('T')[0] : '';
        if (!date) return [];
        return w.sets.map((s) => ({
          date,
          exercise: s.exercise?.name || 'Desconocido',
          muscleGroup: s.exercise?.muscle_group || DEFAULT_MUSCLE_GROUP,
          setNum: s.set_num,
          reps: s.reps,
          weight: s.weight,
        }));
      });
      const cardio: ExcelCardioRow[] = cardioSessions.map((c) => ({
        date: c.startedAt.split('T')[0],
        typeLabel: CARDIO_LABELS[c.type],
        durationMin: Math.round(c.duration / 60),
        distanceKm: c.distance ?? null,
        calories: c.calories ?? null,
        avgHr: c.avgHr ?? null,
        maxHr: c.maxHr ?? null,
        notes: c.notes ?? null,
      }));
      const routineRows: ExcelRoutineRow[] = routines.flatMap((r) =>
        (Object.entries(r.days) as [DayOfWeek, DayRoutine][]).flatMap(([day, dayRoutine]) =>
          dayRoutine.exercises.map((ex) => ({
            routine: r.name,
            description: r.description,
            dayLabel: DAY_LABELS[day],
            exercise: ex.name,
            sets: ex.sets ?? null,
            reps: ex.reps ?? null,
            notes: ex.notes ?? null,
          })),
        ),
      );
      const buffer = await exportAllToXlsx({ strength, cardio, routines: routineRows });
      await saveXlsx(fileName, buffer);
    } catch (e) {
      devError('Error export xlsx', e);
      toast.error(t('history.export_error'));
    }
  };

  const saveBlob = async (fileName: string, data: string, mime: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const uriResult = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
        await Share.share({
          title: t('history.export_share_title'),
          url: uriResult.uri,
          dialogTitle: t('history.export_share_dialog'),
        });
      } catch (err) {
        devError('Error export native', err);
        toast.error(t('history.export_error'));
      }
    } else {
      const blob = new Blob([data], { type: mime });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    }
  };

  const exportToJson = async () => {
    const fileName = `gymlog_${new Date().toISOString().split('T')[0]}.json`;
    await saveBlob(
      fileName,
      buildExportJson(workouts, cardioSessions),
      'application/json;charset=utf-8;',
    );
  };

  // Resumen del pendiente: entrena/series/cardio/rutinas que entrarian y
  // cuantas series ya existen y se saltarian (fecha, ejercicio, set_num).
  const pendingImportSummary = useMemo<ImportSummary | null>(() => {
    if (!pendingImport) return null;
    if (pendingImport.kind === 'json')
      return previewJsonImport(pendingImport.workouts, existingKeys);
    return {
      workouts: 0,
      sets: pendingImport.parsed.strength.length,
      cardio: pendingImport.parsed.cardio.length,
      routines: pendingImport.parsed.routines.length,
      skips: estimateDedupSkips(
        pendingImport.parsed.strength.map((s) => ({ date: s.date, exercise: s.exercise })),
        existingKeys,
      ),
    };
  }, [pendingImport, existingKeys]);

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      toast.error(t('history.select_file_login'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse((event.target?.result as string) || '{}');
        const importedWorkouts = Array.isArray(parsed?.workouts) ? parsed.workouts : null;
        if (!importedWorkouts || importedWorkouts.length === 0) {
          toast.error(t('history.import_json_invalid'));
          return;
        }
        setPendingImport({ kind: 'json', workouts: importedWorkouts });
      } catch (err) {
        devError('Error parseando JSON', err);
        toast.error(t('history.import_error'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const runJsonImport = async (importedWorkouts: unknown[]) => {
    if (!user) return;
    try {
      toast.info(t('history.loading_data'));
      const exerciseList = await fetchExercises(user.id);
      const resolveExerciseId = async (name: string): Promise<string | null> => {
        const clean = (name || '').trim();
        if (clean.length < 2) return null;
        const existing = exerciseList.find((ex) => ex?.name?.toLowerCase() === clean.toLowerCase());
        if (existing?.id) return existing.id;
        const { data: newEx, error } = await supabase
          .from('exercises')
          .insert({ name: clean, user_id: user.id, muscle_group: DEFAULT_MUSCLE_GROUP })
          .select('id, name')
          .single();
        if (error || !newEx) return null;
        exerciseList.push({
          id: newEx.id,
          name: clean,
          muscle_group: DEFAULT_MUSCLE_GROUP,
          muscle_detail: null,
          equipment: 'Gimnasio',
          movement: null,
          is_bilateral: true,
          is_bodyweight: false,
          load_type: 'external',
          is_compound: false,
          is_public: false,
          description: null,
          media_url: null,
          user_id: user.id,
          created_at: '',
        });
        return newEx.id;
      };

      // Dedupe por (fecha, ejercicio, set_num): lo ya existente se salta y se
      // acumula en el mismo set para no re-importar duplicados intra-archivo.
      const dedupeKeys = new Set(existingKeys);
      let workoutsImported = 0;
      let skipped = 0;

      // Se valida una sola vez, aquí: a partir de este punto las series ya son
      // números dentro de rango y no hace falta volver a desconfiar de ellas.
      const { workouts: parsedWorkouts } = parseImportedWorkouts(importedWorkouts);

      for (const { startedAt, finishedAt, date, byExercise } of parsedWorkouts) {
        let savedAny = false;
        for (const [exName, exSets] of byExercise) {
          const exerciseId = await resolveExerciseId(exName);
          if (!exerciseId) continue;
          const setsPayload = exSets
            .map((s, i) => ({
              set_num: s.set_num ?? i + 1,
              reps: s.reps,
              weight: s.weight,
              is_warmup: s.is_warmup,
              notes: s.notes,
              rpe: s.rpe,
            }))
            .filter((s) => {
              const key = makeDedupKey(date, exName, s.set_num);
              if (dedupeKeys.has(key)) {
                skipped++;
                return false;
              }
              dedupeKeys.add(key);
              return true;
            });
          if (!setsPayload.length) continue;
          const { error } = await supabase.rpc('save_workout_with_sets', {
            p_user_id: user.id,
            p_exercise_id: exerciseId,
            p_started_at: startedAt,
            p_finished_at: finishedAt,
            p_sets: setsPayload,
          });
          if (!error) savedAny = true;
        }
        if (savedAny) workoutsImported++;
      }

      refetchSets();
      refetchWorkouts();
      queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
      let message = t('history.import_success', { count: workoutsImported });
      if (skipped > 0) message += ` ${t('history.import_duplicates_skipped', { count: skipped })}`;
      if (workoutsImported > 0) toast.success(message);
      else toast.error(t('history.import_none'));
    } catch (err) {
      devError('Error import JSON', err);
      toast.error(t('history.import_error'));
    }
  };

  const runExcelImport = async (parsed: ParsedImport) => {
    if (!user) return;
    try {
      toast.info(t('history.loading_data'));
      const result = await applyExcelImport(user.id, parsed, existingKeys);
      for (const routine of parsed.routines) addRoutine(routine);
      if (parsed.routines.length > 0) void saveRoutinesToDb(user.id);
      void syncCardio(user.id);
      refetchSets();
      refetchWorkouts();
      queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
      let message = t('history.import_excel_success', {
        sets: result.sets,
        cardio: result.cardio,
        routines: parsed.routines.length,
      });
      if (result.skipped > 0)
        message += ` ${t('history.import_duplicates_skipped', { count: result.skipped })}`;
      toast.success(message);
    } catch (err) {
      devError('Error import xlsx', err);
      toast.error(t('history.import_error'));
    }
  };

  const confirmImport = async () => {
    const pending = pendingImport;
    setPendingImport(null);
    if (!pending || !user) return;
    if (pending.kind === 'json') await runJsonImport(pending.workouts);
    else await runExcelImport(pending.parsed);
  };

  const cancelImport = () => setPendingImport(null);

  /**
   * Nombre legible de la app de origen, cuando el fichero venía de otro tracker.
   * El diálogo lo usa para que el usuario confirme sabiendo qué se ha detectado:
   * si la detección se equivoca, es el momento de cancelar y no después.
   */
  const pendingImportSource =
    pendingImport?.kind === 'json' && pendingImport.tracker
      ? {
          name: TRACKER_NAME[pendingImport.tracker],
          skippedRows: pendingImport.skippedRows ?? 0,
        }
      : null;

  const importFromCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      toast.error(t('history.select_file_login'));
      return;
    }

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xlsx')) {
      void (async () => {
        try {
          const parsed = await parseXlsxFile(await file.arrayBuffer());
          setPendingImport({ kind: 'excel', parsed });
        } catch (err) {
          devError('Error parseando xlsx', err);
          toast.error(t('history.import_error'));
        }
      })();
      e.target.value = '';
      return;
    }

    const validExtensions = ['.csv', '.txt'];
    if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
      toast.error(t('history.invalid_format'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;

        if (!text || text.trim().length === 0) {
          toast.error(t('history.file_empty'));
          return;
        }

        // Primero se intenta leer como export de otra app (Strong, Hevy,
        // FitNotes). Va por cabeceras, así que o reconoce el fichero o falla
        // limpio; si falla, se cae al importador de posición de siempre, que es
        // el que entiende los CSV propios.
        try {
          const fromTracker = parseTrackerCsv(text);
          if (fromTracker.workouts.length > 0) {
            setPendingImport({
              kind: 'json',
              workouts: fromTracker.workouts,
              tracker: fromTracker.tracker,
              skippedRows: fromTracker.skippedRows,
            });
            return;
          }
        } catch (err) {
          // Solo se ignora el «esto no es de un tracker conocido»: cualquier
          // otro error sí es un fallo de verdad y no debe pasar en silencio.
          if (!(err instanceof TrackerFormatError)) {
            devError('Error leyendo CSV de tracker', err);
          }
        }

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
          toast.error(t('history.file_insufficient'));
          return;
        }

        toast.info(t('history.loading_data'));
        const exerciseList = await fetchExercises(user.id);

        const getExerciseId = async (name: string): Promise<string | null> => {
          const cleanName = name.replace(/["']/g, '').trim();
          if (!cleanName || cleanName.length < 2) return null;

          const existing = exerciseList.find(
            (ex) => ex && ex.name && ex.name.toLowerCase() === cleanName.toLowerCase(),
          );

          if (existing?.id) return existing.id;

          try {
            const { data: newEx, error } = await supabase
              .from('exercises')
              .insert({
                name: cleanName,
                user_id: user.id,
                muscle_group: DEFAULT_MUSCLE_GROUP,
              })
              .select('id')
              .single();

            if (error || !newEx) return null;

            exerciseList.push({
              id: newEx.id,
              name: cleanName,
              muscle_group: DEFAULT_MUSCLE_GROUP,
              muscle_detail: null,
              equipment: 'Gimnasio',
              movement: null,
              is_bilateral: true,
              is_bodyweight: false,
              load_type: 'external',
              is_compound: false,
              is_public: false,
              description: null,
              media_url: null,
              user_id: user.id,
              created_at: '',
            });
            return newEx.id;
          } catch {
            return null;
          }
        };

        let imported = 0;
        const errors: string[] = [];
        const dateWorkoutMap: Record<string, string> = {};
        const exerciseSetCounts: Record<string, number> = {};
        const dedupeCsvKeys = new Set(existingKeys);
        let skippedCsv = 0;
        let currentDate = new Date().toISOString().split('T')[0];

        for (let i = 0; i < lines.length; i++) {
          const lineNum = i + 1;
          const line = lines[i];

          if (line.length > 1000) continue;

          const cols = tokenizeCsvLine(line);
          while (cols.length < 5) cols.push('');

          const firstCol = cols[0].replace(/^"|"$/g, '').trim();
          const secondCol = cols[1]?.replace(/^"|"$/g, '').trim() || '';
          const thirdCol = cols[2]?.replace(/^"|"$/g, '').trim() || '';
          const fourthCol = cols[3]?.replace(/^"|"$/g, '').trim() || '';

          if (firstCol.toLowerCase() === 'fecha') {
            continue;
          }

          const dateFromSecondOrThird = parseDate(secondCol) || parseDate(thirdCol);
          if (isHeaderLine(firstCol) && dateFromSecondOrThird) {
            currentDate = dateFromSecondOrThird;
            continue;
          }

          if (!firstCol || firstCol.length < 2) continue;

          const skipPhrases = [
            'no hay registros',
            'sin registros',
            'sin datos',
            'descanso',
            'libre',
          ];
          if (
            skipPhrases.some(
              (p) => secondCol.toLowerCase().includes(p) || firstCol.toLowerCase().includes(p),
            )
          )
            continue;

          const dateFromFirstCol = parseDate(firstCol);

          let parsedDate = currentDate;
          let exerciseName = '';
          let reps = 10;
          let weight = 0;
          const setNum = 1;
          const isNewFormat = false;

          if (dateFromFirstCol && cols.length >= 4) {
            parsedDate = dateFromFirstCol;
            currentDate = parsedDate;
            exerciseName = secondCol;
            reps = parseNumber(thirdCol) || 10;
            weight = parseNumber(fourthCol) || 0;
          } else {
            exerciseName = firstCol;
            weight = parseNumber(secondCol) || parseNumber(thirdCol) || 0;
            reps = parseNumber(thirdCol) || parseNumber(fourthCol) || 10;
          }

          if (weight === null || weight === 0) continue;

          if (!dateWorkoutMap[parsedDate]) {
            const { data: workoutData, error: woError } = await supabase
              .from('workouts')
              .insert({ user_id: user.id, started_at: parsedDate })
              .select('id')
              .single();

            if (woError || !workoutData) {
              errors.push(`Fila ${lineNum}: Error creando entrenamiento`);
              continue;
            }

            dateWorkoutMap[parsedDate] = workoutData.id;
          }

          const exerciseId = await getExerciseId(exerciseName);

          if (!exerciseId) {
            errors.push(`Fila ${lineNum}: "${exerciseName}" no se pudo crear`);
            continue;
          }

          let finalSetNum = setNum;
          if (!isNewFormat) {
            const key = `${parsedDate}_${exerciseId}`;
            exerciseSetCounts[key] = (exerciseSetCounts[key] || 0) + 1;
            finalSetNum = exerciseSetCounts[key];
          }

          const dedupeKey = makeDedupKey(parsedDate, exerciseName, finalSetNum);
          if (dedupeCsvKeys.has(dedupeKey)) {
            skippedCsv++;
            continue;
          }
          dedupeCsvKeys.add(dedupeKey);

          const { error: insertError } = await supabase.from('workout_sets').insert({
            workout_id: dateWorkoutMap[parsedDate],
            exercise_id: exerciseId,
            weight: weight,
            reps: reps,
            set_num: finalSetNum,
          });

          if (insertError) continue;

          imported++;
        }

        if (imported > 0) {
          await refetchSets();
          await refetchWorkouts();
        }

        let message =
          imported > 0
            ? t('history.import_success', { count: imported })
            : t('history.import_none');

        if (skippedCsv > 0)
          message += ` ${t('history.import_duplicates_skipped', { count: skippedCsv })}`;

        if (errors.length > 0)
          message += ` ${t('history.import_skipped', { count: errors.length })}`;

        if (imported > 0) toast.success(message);
        else toast.error(message);
      } catch (err) {
        devError('Import error:', err);
        toast.error(t('history.import_unexpected'));
      }
    };

    reader.onerror = () => {
      toast.error(t('history.read_file_error'));
    };

    reader.readAsText(file);
    e.target.value = '';
  };
  return {
    exportToExcel,
    exportToJson,
    importFromJson,
    importFromCsv,
    pendingImport,
    pendingImportSummary,
    pendingImportSource,
    confirmImport,
    cancelImport,
  };
}
