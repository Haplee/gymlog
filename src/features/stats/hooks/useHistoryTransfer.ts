import { useMemo, useRef, useState } from 'react';
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
import {
  fetchExercises,
  fetchExistingSetKeysBetween,
  insertMissingWeights,
} from '@shared/api/queries';
import { onlyRepSets } from '@shared/lib/setShape';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import { isIdempotencyConflict, retryOnNetwork } from '@shared/lib/idempotency';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import type { WorkoutWithSets } from '@shared/lib/types';
import {
  tokenizeCsvLine,
  parseImportNumber as parseNumber,
  parseImportDate as parseDate,
  isHeaderLine,
  buildExportJson,
  buildExistingDedupKeys,
  collectCsvDateRange,
  collectDateRange,
  estimateDedupSkips,
  makeDedupKey,
  type DedupCandidate,
} from '../utils/exportImport';
import { withImportLock } from '../utils/importLock';
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
import {
  parseAppleHealthExport,
  AppleHealthFormatError,
  type PesoImportado,
} from '../utils/importAppleHealth';
import { applyExcelImport } from '../utils/applyExcelImport';
import { deriveImportKey, newImportId } from '../utils/importIdentity';

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
  | { kind: 'excel'; parsed: ParsedImport }
  | {
      kind: 'health';
      /** Un peso por día, ya en kg y ordenados. */
      weights: PesoImportado[];
      /** Registros descartados por fecha o valor imposible. */
      descartados: number;
    };

/** Conteo de lo que entraria al confirmar un import pendiente. */
interface ImportSummary {
  workouts: number;
  sets: number;
  cardio: number;
  routines: number;
  /** Series que ya existen (fecha, ejercicio, set_num) y se saltarian. */
  skips: number;
  /** Días con peso corporal que entrarían (solo importación de Apple Health). */
  weights?: number;
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

/**
 * Claves ya guardadas en el tramo de fechas de un fichero.
 *
 * Es lo que hace el dedupe independiente de la ventana de `fetchWorkouts`
 * (1000 entrenos): un CSV/Excel/JSON más antiguo que esa ventana no vería nada
 * y una reimportación duplicaría series. Si la consulta falla se degrada a la
 * ventana en memoria —peor cobertura, pero abortar perdería la importación— y
 * el fallo queda en consola, no se convierte en un éxito silencioso.
 */
async function loadRangeKeys(
  userId: string,
  range: { from: string; to: string } | null,
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!range) return keys;
  try {
    const rows = await fetchExistingSetKeysBetween(userId, range.from, range.to);
    for (const row of rows) keys.add(makeDedupKey(row.date, row.exercise, row.setNum));
  } catch (err) {
    devError('No se pudieron leer las claves existentes del rango', err);
  }
  return keys;
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
  /**
   * Claves que este mismo hook ya ha insertado. `existingKeys` sale de las props
   * y `refetchWorkouts` es asíncrono: una segunda importación seguida decide con
   * un `workouts` viejo. La base se vuelve a consultar por rango al empezar,
   * pero este set cubre también el caso de que esa consulta no traiga nada.
   */
  const importedKeysRef = useRef<Set<string>>(new Set());

  /**
   * Semilla de dedupe de una importación: la ventana cargada, lo que ya insertó
   * este hook y las claves reales del rango del fichero. Se construye dentro del
   * turno de importación para que la segunda operación vea lo de la primera.
   */
  const buildDedupeSeed = async (
    userId: string,
    range: { from: string; to: string } | null,
  ): Promise<Set<string>> => {
    const keys = new Set(existingKeys);
    for (const key of importedKeysRef.current) keys.add(key);
    for (const key of await loadRangeKeys(userId, range)) keys.add(key);
    return keys;
  };

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
        // La hoja tiene columna de repeticiones y no de duración: una serie por
        // tiempo no cabe en ella todavía. Hoy no descarta nada (`reps` es NOT
        // NULL); cuando existan, la exportación necesita su propia columna.
        // Ver openspec/changes/add-logging-modes/ tarea 3.4.
        return onlyRepSets(w.sets).map((s) => ({
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
      buildExportJson(
        // Mismo motivo que en la exportación a Excel.
        workouts.map((w) => ({ ...w, sets: onlyRepSets(w.sets) })),
        cardioSessions,
      ),
      'application/json;charset=utf-8;',
    );
  };

  // Resumen del pendiente: entrena/series/cardio/rutinas que entrarian y
  // cuantas series ya existen y se saltarian (fecha, ejercicio, set_num).
  const pendingImportSummary = useMemo<ImportSummary | null>(() => {
    if (!pendingImport) return null;
    if (pendingImport.kind === 'json')
      return previewJsonImport(pendingImport.workouts, existingKeys);
    if (pendingImport.kind === 'health') {
      return {
        workouts: 0,
        sets: 0,
        cardio: 0,
        routines: 0,
        skips: 0,
        weights: pendingImport.weights.length,
      };
    }
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

  const runJsonImport = async (importedWorkouts: unknown[], importId: string) => {
    if (!user) return;
    const userId = user.id;
    try {
      toast.info(t('history.loading_data'));

      // Se valida una sola vez, fuera del turno. El rango de fechas sale de los
      // mismos `started_at` que luego usa el dedupe, así que la consulta cubre
      // exactamente las fechas que el importador va a escribir.
      const { workouts: parsedWorkouts } = parseImportedWorkouts(importedWorkouts);

      const { workoutsImported, skipped, failed } = await withImportLock(async () => {
        const exerciseList = await fetchExercises(userId);
        const resolveExerciseId = async (name: string): Promise<string | null> => {
          const clean = (name || '').trim();
          if (clean.length < 2) return null;
          const existing = exerciseList.find(
            (ex) => ex?.name?.toLowerCase() === clean.toLowerCase(),
          );
          if (existing?.id) return existing.id;
          const { data: newEx, error } = await supabase
            .from('exercises')
            .insert({ name: clean, user_id: userId, muscle_group: DEFAULT_MUSCLE_GROUP })
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
            user_id: userId,
            created_at: '',
          });
          return newEx.id;
        };

        // El JSON es incremental (varios ejercicios por día), no una
        // restauración: se deduplica igual que CSV y Excel, pero contra el rango
        // real del fichero para no depender de la ventana de 1000 entrenos. Lo
        // ya existente se salta y se acumula en el mismo set para no reimportar
        // duplicados intra-archivo.
        const dedupeKeys = await buildDedupeSeed(
          userId,
          collectDateRange(parsedWorkouts.map((w) => w.date)),
        );
        let skipped = 0;
        let failed = 0;
        const pendingKeys: string[] = [];
        const workoutIndexes = new Set<number>();
        const payload: {
          started_at: string;
          finished_at: string;
          exercise_id: string;
          sets: {
            set_num: number;
            reps: number;
            weight: number;
            is_warmup: boolean;
            notes: string;
            rpe: string;
          }[];
        }[] = [];

        // `for...of` y no `forEach`: el cuerpo resuelve o crea ejercicios y eso
        // es asíncrono. Dentro de un callback de `forEach` el `await` no
        // compila y el orden de las series dejaría de ser el del fichero.
        for (const [workoutIndex, workout] of parsedWorkouts.entries()) {
          for (const [exName, exSets] of workout.byExercise) {
            // Primero se descartan las series que ya existen; solo después se
            // resuelve o crea el ejercicio. Si todas eran duplicadas, el nombre
            // no debe aparecer en el catálogo ni abrirse un entreno.
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
                const key = makeDedupKey(workout.date, exName, s.set_num);
                if (dedupeKeys.has(key)) {
                  skipped++;
                  return false;
                }
                dedupeKeys.add(key);
                return true;
              });
            if (!setsPayload.length) continue;

            const exerciseId = await resolveExerciseId(exName);
            if (!exerciseId) {
              failed += setsPayload.length;
              continue;
            }

            payload.push({
              started_at: workout.startedAt,
              finished_at: workout.finishedAt,
              exercise_id: exerciseId,
              sets: setsPayload,
            });
            workoutIndexes.add(workoutIndex);
            for (const s of setsPayload) {
              pendingKeys.push(makeDedupKey(workout.date, exName, s.set_num));
            }
          }
        }

        if (payload.length === 0) {
          return { workoutsImported: 0, skipped, failed };
        }

        // Una sola RPC para todo el fichero: o entra el lote completo o no entra
        // nada. La clave de cada entreno la deriva el servidor del `importId`
        // (creado antes de la primera escritura y reutilizado por los reintentos
        // de red), así que una respuesta perdida no duplica y una importación
        // manual nueva no se confunde con esta.
        await retryOnNetwork(async () => {
          const { error } = await supabase.rpc('import_history_workouts', {
            p_user_id: userId,
            p_import_id: importId,
            p_workouts: payload,
          });
          if (error) throw error;
        });

        // Solo lo que llegó a guardarse: si la RPC falla no se marca nada y un
        // reintento debe volver a intentar esas series.
        for (const key of pendingKeys) importedKeysRef.current.add(key);

        return { workoutsImported: workoutIndexes.size, skipped, failed };
      });

      refetchSets();
      refetchWorkouts();
      queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
      let message = t('history.import_success', { count: workoutsImported });
      if (skipped > 0) message += ` ${t('history.import_duplicates_skipped', { count: skipped })}`;
      if (failed > 0) message += ` ${t('history.import_failed', { count: failed })}`;
      if (workoutsImported > 0) toast.success(message);
      else toast.error(message);
    } catch (err) {
      devError('Error import JSON', err);
      // Un conflicto de idempotencia es definitivo: repetir la misma clave con
      // otra carga no lo arregla y no debe parecer un fallo de red.
      toast.error(
        isIdempotencyConflict(err) ? t('history.import_conflict') : t('history.import_error'),
      );
    }
  };

  const runExcelImport = async (parsed: ParsedImport, importId: string) => {
    if (!user) return;
    const userId = user.id;
    try {
      toast.info(t('history.loading_data'));
      const result = await withImportLock(async () => {
        const seed = await buildDedupeSeed(
          userId,
          collectDateRange(parsed.strength.map((s) => s.date)),
        );
        const applied = await applyExcelImport(userId, parsed, seed, importId);
        // El set local cubre la siguiente importación aunque el refetch aún no
        // haya traído las series recién escritas.
        for (const key of applied.importedKeys) importedKeysRef.current.add(key);
        return applied;
      });
      for (const routine of parsed.routines) addRoutine(routine);
      if (parsed.routines.length > 0) void saveRoutinesToDb(userId);
      void syncCardio(userId);
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
      if (result.failed > 0) message += ` ${t('history.import_failed', { count: result.failed })}`;
      toast.success(message);
    } catch (err) {
      devError('Error import xlsx', err);
      toast.error(t('history.import_error'));
    }
  };

  /**
   * Lee un `export.xml` de Apple Health y prepara los pesos para confirmar.
   *
   * El fichero puede pesar cientos de megas, así que no se lee entero: el lector
   * va por trozos (ver `importAppleHealth`). Se acepta también el `.zip` tal
   * cual sale del móvil solo para poder avisar de que hay que descomprimirlo
   * antes — descomprimirlo aquí exigiría una dependencia nueva.
   */
  const importFromAppleHealth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) {
      toast.error(t('history.select_file_login'));
      return;
    }

    if (file.name.toLowerCase().endsWith('.zip')) {
      toast.error(t('history.health_zip_hint'));
      return;
    }

    void (async () => {
      try {
        toast.info(t('history.health_reading'));
        const { weights, descartados } = await parseAppleHealthExport(file);
        if (weights.length === 0) {
          toast.error(t('history.health_no_weights'));
          return;
        }
        setPendingImport({ kind: 'health', weights, descartados });
      } catch (err) {
        if (err instanceof AppleHealthFormatError) {
          toast.error(t('history.health_invalid'));
          return;
        }
        devError('Error leyendo export de Apple Health', err);
        toast.error(t('history.import_error'));
      }
    })();
  };

  const runHealthImport = async (weights: PesoImportado[]) => {
    if (!user) return;
    try {
      toast.info(t('history.loading_data'));
      const { inserted, skipped } = await insertMissingWeights(
        user.id,
        weights.map((w) => ({ date: w.date, weightKg: w.weightKg })),
      );
      queryClient.invalidateQueries({ queryKey: ['bodyMeasurements'], refetchType: 'all' });
      let message = t('history.health_success', { count: inserted });
      if (skipped > 0) message += ` ${t('history.health_skipped', { count: skipped })}`;
      if (inserted > 0) toast.success(message);
      else toast.info(t('history.health_all_existing'));
    } catch (err) {
      devError('Error importando pesos de Apple Health', err);
      toast.error(t('history.import_error'));
    }
  };

  const confirmImport = async () => {
    const pending = pendingImport;
    setPendingImport(null);
    if (!pending || !user) return;
    // Identidad de la operación manual: se crea una vez, antes de la primera
    // escritura. Los reintentos de red del mismo envío la reutilizan; confirmar
    // otra importación genera otra, aunque el fichero sea el mismo.
    const importId = newImportId();
    if (pending.kind === 'json') await runJsonImport(pending.workouts, importId);
    else if (pending.kind === 'health') await runHealthImport(pending.weights);
    else await runExcelImport(pending.parsed, importId);
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

        // El turno se toma antes de leer las claves existentes y se suelta al
        // insertar la última serie: dos pestañas importando a la vez no pueden
        // decidir con la misma foto y escribir lo mismo.
        //
        // La identidad de esta importación manual se crea antes de la primera
        // escritura. Las claves de cada día se derivan de ella: un reintento de
        // red conserva la clave y una importación nueva usa otra identidad.
        const importId = newImportId();
        const runImport = async () => {
          let imported = 0;
          const errors: string[] = [];
          const exerciseSetCounts: Record<string, number> = {};

          // Un día = un entreno = una transacción de servidor. Antes el entreno
          // se creaba con un INSERT y cada serie con otro: si la red se cortaba
          // a mitad, el día quedaba incompleto y el reintento lo duplicaba.
          const setsByDate = new Map<
            string,
            { exercise_id: string; set_num: number; reps: number; weight: number }[]
          >();
          const keysByDate = new Map<string, string[]>();

          // Claves ya existentes: la ventana de historial cargada, lo importado
          // por este hook y el tramo de fechas del propio fichero. Lo último es lo
          // que hace el dedupe independiente de `fetchWorkouts` (1000 entrenos):
          // un CSV más antiguo que esa ventana no veía nada y duplicaba series.
          const dedupeCsvKeys = await buildDedupeSeed(user.id, collectCsvDateRange(lines));

          let skippedCsv = 0;
          let currentDate = toLocalDateKey(new Date());

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

            // El contador y el dedupe van ANTES de resolver el ejercicio: una fila
            // que se va a descartar por duplicada no debe crear nada en el
            // catálogo. Con el orden inverso, reimportar un CSV dejaba un
            // ejercicio nuevo y sin series por cada nombre descartado.
            let finalSetNum = setNum;
            if (!isNewFormat) {
              // Misma clave que `estimateDedupSkips`: por nombre y fecha, para
              // poder decidir sin haber resuelto aún el id del catálogo.
              const counterKey = `${parsedDate}|${exerciseName.trim().toLowerCase()}`;
              exerciseSetCounts[counterKey] = (exerciseSetCounts[counterKey] || 0) + 1;
              finalSetNum = exerciseSetCounts[counterKey];
            }

            const dedupeKey = makeDedupKey(parsedDate, exerciseName, finalSetNum);
            if (dedupeCsvKeys.has(dedupeKey)) {
              skippedCsv++;
              continue;
            }
            dedupeCsvKeys.add(dedupeKey);

            const exerciseId = await getExerciseId(exerciseName);

            if (!exerciseId) {
              errors.push(`Fila ${lineNum}: "${exerciseName}" no se pudo crear`);
              continue;
            }

            // El entreno del día se crea al final, con todas sus series ya
            // validadas y resueltas. Antes se creaba al ver la primera fila:
            // reimportar el mismo CSV dejaba un entreno vacío por fecha, porque
            // todas las series se saltaban después.
            const daySets = setsByDate.get(parsedDate) ?? [];
            daySets.push({
              exercise_id: exerciseId,
              set_num: finalSetNum,
              reps,
              weight,
            });
            setsByDate.set(parsedDate, daySets);

            const dayKeys = keysByDate.get(parsedDate) ?? [];
            dayKeys.push(dedupeKey);
            keysByDate.set(parsedDate, dayKeys);
          }

          // Una transacción por fecha. La clave se deriva del id de la
          // importación y no cambia entre reintentos de red: si el lote llegó a
          // entrar, el servidor devuelve el mismo entreno en vez de duplicarlo.
          for (const [date, daySets] of setsByDate) {
            const clientId = deriveImportKey(importId, `workout:${date}`);
            try {
              await retryOnNetwork(async () => {
                const { error } = await supabase.rpc('save_workout_with_sets', {
                  p_user_id: user.id,
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
              imported += daySets.length;
              // Solo cuenta como importada si el lote se guardó: si la RPC
              // falla, un reintento debe volver a intentar esas series.
              for (const key of keysByDate.get(date) ?? []) importedKeysRef.current.add(key);
            } catch (err) {
              // Un error por serie del día: el resumen cuenta series que no se
              // importaron, y un día entero perdido no debe parecer una sola.
              for (let i = 0; i < daySets.length; i++) {
                errors.push(`Fecha ${date}: no se pudo guardar`);
              }
              devError(`Error importando CSV del ${date}:`, err);
            }
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
        };

        await withImportLock(runImport);
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
    importFromAppleHealth,
    pendingImport,
    pendingImportSummary,
    pendingImportSource,
    confirmImport,
    cancelImport,
  };
}
