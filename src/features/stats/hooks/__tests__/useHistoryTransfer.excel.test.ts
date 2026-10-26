// @vitest-environment jsdom
// Ruta Excel de `useHistoryTransfer`. `applyExcelImport` tiene sus propias
// pruebas de contador y creación diferida; aquí se fija lo que solo se ve al
// orquestar: consulta del rango de fechas, turno de importación, acumulación de
// claves y el hecho de que la ventana de 1000 entrenos no decide el dedupe.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeEvent } from 'react';
import type { WorkoutWithSets } from '@shared/lib/types';
import type { ParsedImport } from '../../utils/excelImport';

const db = vi.hoisted(() => {
  interface StoredWorkout {
    id: string;
    user_id: string;
    started_at: string;
    client_id: string;
    sets: Record<string, unknown>[];
  }

  const inserts: { table: string; payload: Record<string, unknown> }[] = [];
  const workouts: StoredWorkout[] = [];
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const failTables = new Set<string>();
  let failRpc = false;
  let seq = 0;

  // Servidor de mentira para la RPC: idempotente por `p_client_id`, como el
  // real. Un lote reenviado con la misma clave devuelve el entreno existente.
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    if (failRpc) return { data: null, error: new Error('fallo simulado en la RPC') };

    const existing = workouts.find(
      (w) => w.user_id === args.p_user_id && w.client_id === args.p_client_id,
    );
    if (existing) return { data: existing.id, error: null };

    const id = `workout-${++seq}`;
    workouts.push({
      id,
      user_id: String(args.p_user_id),
      started_at: String(args.p_started_at),
      client_id: String(args.p_client_id),
      sets: (args.p_sets ?? []) as Record<string, unknown>[],
    });
    return { data: id, error: null };
  };

  const resultado = (table: string) => ({
    data: null,
    error: failTables.has(table) ? new Error(`fallo simulado en ${table}`) : null,
  });

  const from = (table: string) => {
    let ultimo: Record<string, unknown> = {};
    const builder = {
      insert: (payload: Record<string, unknown>) => {
        ultimo = payload;
        inserts.push({ table, payload });
        return builder;
      },
      select: () => builder,
      single: async () => {
        if (failTables.has(table)) return { data: null, error: new Error(`fallo simulado`) };
        if (table === 'exercises') {
          return { data: { id: `ex-${String(ultimo.name ?? '').toLowerCase()}` }, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(resultado(table)).then(resolve, reject),
    };
    return builder;
  };

  return {
    inserts,
    workouts,
    rpcCalls,
    from,
    rpc,
    failTable: (table: string) => failTables.add(table),
    failRpc: () => {
      failRpc = true;
    },
    reset() {
      inserts.length = 0;
      workouts.length = 0;
      rpcCalls.length = 0;
      failTables.clear();
      failRpc = false;
      seq = 0;
    },
  };
});

const { toastMock, tMock, fetchExercisesMock, fetchExistingSetKeysBetweenMock, parseXlsxFileMock } =
  vi.hoisted(() => {
    const t = (key: string, opts?: { count?: number }) =>
      opts && opts.count !== undefined ? `${key}:${opts.count}` : key;
    return {
      tMock: t,
      toastMock: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
      fetchExercisesMock: vi.fn(),
      fetchExistingSetKeysBetweenMock: vi.fn(),
      parseXlsxFileMock: vi.fn(),
    };
  });

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: tMock }) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn() },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }));
vi.mock('@features/auth/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 'user-1' } }),
}));
vi.mock('@features/routine/stores/routineStore', () => ({
  useRoutineStore: (selector: (s: unknown) => unknown) =>
    selector({ routines: [], addRoutine: vi.fn(), saveToDb: vi.fn() }),
}));
vi.mock('@features/cardio/stores/cardioStore', () => ({
  useCardioStore: (selector: (s: unknown) => unknown) =>
    selector({ sessions: [], syncFromRemote: vi.fn() }),
  CARDIO_LABELS: {},
}));
vi.mock('@shared/lib/supabase', () => ({ supabase: { from: db.from, rpc: db.rpc } }));
vi.mock('@shared/api/queries', () => ({
  fetchExercises: fetchExercisesMock,
  fetchExistingSetKeysBetween: fetchExistingSetKeysBetweenMock,
  insertMissingWeights: vi.fn(),
}));
vi.mock('../../utils/excelImport', () => ({
  parseXlsxFile: parseXlsxFileMock,
  DAY_LABELS: {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
  },
}));

import { useHistoryTransfer } from '../useHistoryTransfer';

const refetchSetsMock = vi.fn().mockResolvedValue(undefined);
const refetchWorkoutsMock = vi.fn().mockResolvedValue(undefined);

function renderTransfer(workouts: WorkoutWithSets[] = []) {
  return renderHook(() =>
    useHistoryTransfer({
      workouts,
      refetchSets: refetchSetsMock,
      refetchWorkouts: refetchWorkoutsMock,
    }),
  );
}

const insertsDe = (table: string) => db.inserts.filter((i) => i.table === table);
/** Series de todos los entrenos guardados, en el orden en que se escribieron. */
const setsGuardadas = () => db.workouts.flatMap((w) => w.sets);

/** Claves que la "base" devolvería al empezar otra importación. */
function clavesEnBase() {
  return db.workouts.flatMap((w) =>
    w.sets.map((s) => ({
      date: w.started_at,
      // La RPC guarda el id del catálogo (`ex-sentadilla`): el mismo prefijo que
      // usa el mock al crear un ejercicio nuevo.
      exercise: String(s.exercise_id).replace(/^ex-/, ''),
      setNum: Number(s.set_num),
    })),
  );
}

const parsedCon = (strength: ParsedImport['strength']): ParsedImport => ({
  strength,
  cardio: [],
  routines: [],
});

/** Selecciona un .xlsx y confirma el diálogo. */
async function importExcel(
  hook: {
    current: {
      importFromCsv: (e: ChangeEvent<HTMLInputElement>) => void;
      confirmImport: () => Promise<void>;
    };
  },
  parsed: ParsedImport,
) {
  parseXlsxFileMock.mockResolvedValue(parsed);
  const file = new File(['xlsx'], 'historial.xlsx');
  (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
    new ArrayBuffer(0);
  const event = { target: { files: [file], value: 'historial.xlsx' } };

  await act(async () => {
    hook.current.importFromCsv(event as unknown as ChangeEvent<HTMLInputElement>);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await hook.current.confirmImport();
  });
}

/** Dos confirmaciones sin esperar la primera (mismo fichero pendiente). */
async function importarDosVeces(
  hook: {
    current: {
      importFromCsv: (e: ChangeEvent<HTMLInputElement>) => void;
      confirmImport: () => Promise<void>;
    };
  },
  parsed: ParsedImport,
) {
  parseXlsxFileMock.mockResolvedValue(parsed);
  const file = new File(['xlsx'], 'historial.xlsx');
  (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
    new ArrayBuffer(0);
  const event = { target: { files: [file], value: 'historial.xlsx' } };

  await act(async () => {
    hook.current.importFromCsv(event as unknown as ChangeEvent<HTMLInputElement>);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await Promise.all([hook.current.confirmImport(), hook.current.confirmImport()]);
  });
}

function instalarWebLocksFalsos() {
  let cadena: Promise<unknown> = Promise.resolve();
  let enCurso = 0;
  const estado = { maxConcurrentes: 0 };
  const request = vi.fn((_nombre: string, tarea: () => Promise<unknown>) => {
    const ejecutar = async () => {
      enCurso += 1;
      estado.maxConcurrentes = Math.max(estado.maxConcurrentes, enCurso);
      try {
        return await tarea();
      } finally {
        enCurso -= 1;
      }
    };
    const run = cadena.then(ejecutar, ejecutar);
    cadena = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  });
  vi.stubGlobal('navigator', { onLine: true, locks: { request } });
  return { request, estado };
}

describe('useHistoryTransfer — importación Excel', () => {
  beforeEach(() => {
    db.reset();
    toastMock.info.mockClear();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    fetchExercisesMock.mockReset();
    fetchExercisesMock.mockResolvedValue([]);
    fetchExistingSetKeysBetweenMock.mockReset();
    fetchExistingSetKeysBetweenMock.mockResolvedValue([]);
    parseXlsxFileMock.mockReset();
    refetchSetsMock.mockClear();
    refetchWorkoutsMock.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deduplica una fecha más antigua que la ventana de historial cargada', async () => {
    // La ventana (`workouts`) no tiene nada: sin consultar el rango, este Excel
    // de 2024 duplicaría las dos series que ya están en la base.
    fetchExistingSetKeysBetweenMock.mockResolvedValue([
      { date: '2024-01-05', exercise: 'Sentadilla', setNum: 1 },
      { date: '2024-01-05', exercise: 'Sentadilla', setNum: 2 },
    ]);
    const { result } = renderTransfer([]);

    await importExcel(
      result,
      parsedCon([
        { date: '2024-01-05', exercise: 'Sentadilla', reps: 5, weight: 100 },
        { date: '2024-01-05', exercise: 'Sentadilla', reps: 5, weight: 105 },
      ]),
    );

    expect(fetchExistingSetKeysBetweenMock).toHaveBeenCalledWith(
      'user-1',
      '2024-01-05',
      '2024-01-05',
    );
    expect(db.inserts).toEqual([]);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:2'),
    );
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('pide el rango completo del Excel, no solo el primer día', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer([]);

    await importExcel(
      result,
      parsedCon([
        { date: '2024-03-09', exercise: 'Sentadilla', reps: 5, weight: 100 },
        { date: '2024-01-05', exercise: 'Sentadilla', reps: 5, weight: 105 },
      ]),
    );

    expect(fetchExistingSetKeysBetweenMock).toHaveBeenCalledWith(
      'user-1',
      '2024-01-05',
      '2024-03-09',
    );
    expect(setsGuardadas()).toHaveLength(2);
  });

  it('reimportar el mismo Excel no crea entrenos vacíos ni series nuevas', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    // La segunda lectura del rango ve lo que escribió la primera importación.
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => clavesEnBase());
    const { result } = renderTransfer([]);
    const parsed = parsedCon([
      { date: '2024-01-06', exercise: 'Sentadilla', reps: 5, weight: 100 },
      { date: '2024-01-06', exercise: 'Sentadilla', reps: 5, weight: 105 },
    ]);

    await importExcel(result, parsed);
    await importExcel(result, parsed);

    expect(fetchExistingSetKeysBetweenMock).toHaveBeenCalledTimes(2);
    expect(db.workouts).toHaveLength(1);
    expect(setsGuardadas()).toHaveLength(2);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:2'),
    );
  });

  it('una fecha enteramente duplicada no crea su entreno', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockResolvedValue([
      { date: '2024-01-08', exercise: 'Sentadilla', setNum: 1 },
    ]);
    const { result } = renderTransfer([]);

    await importExcel(
      result,
      parsedCon([
        // Este día ya está completo: no debe dejar un entreno vacío.
        { date: '2024-01-08', exercise: 'Sentadilla', reps: 5, weight: 100 },
        // Este otro es nuevo y sí debe crear su entreno.
        { date: '2024-01-09', exercise: 'Sentadilla', reps: 5, weight: 105 },
      ]),
    );

    expect(db.workouts).toHaveLength(1);
    expect(db.workouts[0]?.started_at).toBe('2024-01-09');
    expect(setsGuardadas()).toHaveLength(1);
  });

  it('las filas descartadas no crean ejercicios en el catálogo', async () => {
    fetchExercisesMock.mockResolvedValue([]);
    fetchExistingSetKeysBetweenMock.mockResolvedValue([
      { date: '2024-01-10', exercise: 'Remo', setNum: 1 },
    ]);
    const { result } = renderTransfer([]);

    await importExcel(
      result,
      parsedCon([{ date: '2024-01-10', exercise: 'Remo', reps: 10, weight: 40 }]),
    );

    expect(insertsDe('exercises')).toEqual([]);
    expect(db.inserts).toEqual([]);
    expect(db.rpcCalls).toEqual([]);
  });

  it('si la consulta del rango falla, importa igual y lo deja en consola', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockRejectedValue(new Error('sin permisos'));
    const { result } = renderTransfer([]);

    await importExcel(
      result,
      parsedCon([{ date: '2024-02-01', exercise: 'Sentadilla', reps: 5, weight: 100 }]),
    );

    // No se aborta por no poder leer el histórico: se degrada a la ventana y el
    // riesgo queda señalado en consola, no oculto.
    expect(setsGuardadas()).toHaveLength(1);
    expect(toastMock.success).toHaveBeenCalledWith('history.import_excel_success');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('claves existentes del rango'),
      expect.any(Error),
    );
  });

  it('dos importaciones a la vez se turnan: la segunda vuelve a leer las claves', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const lecturas: number[] = [];
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => {
      const claves = clavesEnBase();
      lecturas.push(claves.length);
      return claves;
    });
    const { result } = renderTransfer([]);

    await importarDosVeces(
      result,
      parsedCon([
        { date: '2024-04-01', exercise: 'Sentadilla', reps: 5, weight: 100 },
        { date: '2024-04-01', exercise: 'Sentadilla', reps: 5, weight: 105 },
      ]),
    );

    // La primera encuentra la base vacía; la segunda arranca después y la ve.
    expect(lecturas).toEqual([0, 2]);
    expect(db.workouts).toHaveLength(1);
    expect(setsGuardadas()).toHaveLength(2);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:2'),
    );
  });

  it('con Web Locks las importaciones Excel no se solapan', async () => {
    const { estado } = instalarWebLocksFalsos();
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => clavesEnBase());
    const { result } = renderTransfer([]);

    await importarDosVeces(
      result,
      parsedCon([{ date: '2024-05-01', exercise: 'Sentadilla', reps: 5, weight: 100 }]),
    );

    expect(estado.maxConcurrentes).toBe(1);
    expect(setsGuardadas()).toHaveLength(1);
  });

  it('un Excel sin filas no produce registros ni toca el catálogo', async () => {
    const { result } = renderTransfer([]);

    await importExcel(result, parsedCon([]));

    expect(db.inserts).toEqual([]);
    expect(db.rpcCalls).toEqual([]);
    expect(toastMock.success).toHaveBeenCalledWith('history.import_excel_success');
  });

  it('el turno usa las claves guardadas por la propia ruta, no solo el rango', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    // El rango siempre miente y devuelve vacío. Aun así, `importedKeysRef` debe
    // evitar que dos importaciones seguidas dupliquen lo recién escrito.
    fetchExistingSetKeysBetweenMock.mockResolvedValue([]);
    const { result } = renderTransfer([]);
    const parsed = parsedCon([
      { date: '2024-06-01', exercise: 'Sentadilla', reps: 5, weight: 100 },
    ]);

    await importExcel(result, parsed);
    await importExcel(result, parsed);

    expect(setsGuardadas()).toHaveLength(1);
  });
});
