// @vitest-environment jsdom
// Ruta JSON de `useHistoryTransfer`. El JSON es incremental (RPC por ejercicio),
// no una restauración: por eso comparte dedupe por (fecha, ejercicio, set_num)
// con CSV y Excel, pero conserva el `set_num` explícito del fichero y la RPC
// transaccional. Aquí se fija ese contrato y el rango fuera de la ventana.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeEvent } from 'react';
import type { WorkoutWithSets } from '@shared/lib/types';

const db = vi.hoisted(() => {
  interface StoredImport {
    payload: string;
    items: Record<string, unknown>[];
  }

  const inserts: { table: string; payload: Record<string, unknown>; id: string }[] = [];
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const imports = new Map<string, StoredImport>();
  let seq = 0;
  let failNext = false;
  let conflictNext = false;
  let loseNextResponse = false;
  let failExerciseInsert = false;

  const from = (table: string) => {
    const builder = {
      insert: (payload: Record<string, unknown>) => {
        const id = `${table}-${++seq}`;
        inserts.push({ table, payload, id });
        return builder;
      },
      select: () => builder,
      single: async () => {
        if (table === 'exercises') {
          if (failExerciseInsert) return { data: null, error: new Error('sin permisos') };
          const last = inserts.filter((i) => i.table === 'exercises');
          const nombre = last[last.length - 1]?.payload.name;
          return { data: { id: `ex-${String(nombre ?? '').toLowerCase()}` }, error: null };
        }
        return { data: null, error: null };
      },
    };
    return builder;
  };

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    if (fn !== 'import_history_workouts') return { data: null, error: null };

    if (failNext) {
      failNext = false;
      return { data: null, error: new Error('fallo simulado en la RPC') };
    }
    if (conflictNext) {
      conflictNext = false;
      return { data: null, error: { message: 'idempotency_conflict' } };
    }

    const importId = String(args.p_import_id);
    const items = (args.p_workouts ?? []) as Record<string, unknown>[];
    const payload = JSON.stringify(items);
    const existing = imports.get(importId);
    if (existing && existing.payload !== payload) {
      return { data: null, error: { message: 'idempotency_conflict' } };
    }
    if (!existing) imports.set(importId, { payload, items });

    // «El servidor escribió y la respuesta se perdió»: el reintento con la
    // misma identidad encuentra el lote ya guardado.
    if (loseNextResponse) {
      loseNextResponse = false;
      throw new TypeError('Failed to fetch');
    }
    return { data: (existing?.items ?? items).length, error: null };
  };

  return {
    inserts,
    rpcCalls,
    imports,
    from,
    rpc,
    failNext: () => {
      failNext = true;
    },
    conflictNext: () => {
      conflictNext = true;
    },
    loseNextResponse: () => {
      loseNextResponse = true;
    },
    failExerciseInsert: () => {
      failExerciseInsert = true;
    },
    writtenItems: () => [...imports.values()].flatMap((entry) => entry.items),
    importIds: () =>
      rpcCalls
        .filter((call) => call.fn === 'import_history_workouts')
        .map((call) => String(call.args.p_import_id)),
    reset() {
      inserts.length = 0;
      rpcCalls.length = 0;
      imports.clear();
      seq = 0;
      failNext = false;
      conflictNext = false;
      loseNextResponse = false;
      failExerciseInsert = false;
    },
  };
});

const { toastMock, tMock, fetchExercisesMock, fetchExistingSetKeysBetweenMock } = vi.hoisted(() => {
  const t = (key: string, opts?: { count?: number }) =>
    opts && opts.count !== undefined ? `${key}:${opts.count}` : key;
  return {
    tMock: t,
    toastMock: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
    fetchExercisesMock: vi.fn(),
    fetchExistingSetKeysBetweenMock: vi.fn(),
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

import { useHistoryTransfer } from '../useHistoryTransfer';

/* ------------------------------------------------ FileReader controlable --- */

const fileTexts = new Map<File, string>();
let lecturaEnCurso: Promise<unknown> = Promise.resolve();

class FakeFileReader {
  onload: ((event: { target: { result: string } }) => unknown) | null = null;
  onerror: (() => void) | null = null;
  readAsText(file: File) {
    const text = fileTexts.get(file) ?? '';
    lecturaEnCurso = Promise.resolve().then(() => this.onload?.({ target: { result: text } }));
  }
}

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

/** JSON de importación en la forma que valida `importSchema`. */
function jsonWorkout(
  date: string,
  sets: { exercise: string; set_num?: number; reps?: number; weight?: number }[],
) {
  return {
    started_at: `${date}T10:00:00.000Z`,
    finished_at: `${date}T11:00:00.000Z`,
    sets: sets.map((s) => ({
      exercise: s.exercise,
      set_num: s.set_num,
      reps: s.reps ?? 5,
      weight: s.weight ?? 100,
    })),
  };
}

async function seleccionarJson(
  hook: { current: { importFromJson: (e: ChangeEvent<HTMLInputElement>) => void } },
  workouts: unknown[],
) {
  const content = JSON.stringify({ workouts });
  const file = new File([content], 'historial.json', { type: 'application/json' });
  fileTexts.set(file, content);
  const event = { target: { files: [file], value: 'historial.json' } };

  act(() => hook.current.importFromJson(event as unknown as ChangeEvent<HTMLInputElement>));
  await act(async () => {
    await lecturaEnCurso;
  });
}

async function importJson(
  hook: {
    current: {
      importFromJson: (e: ChangeEvent<HTMLInputElement>) => void;
      confirmImport: () => Promise<void>;
    };
  },
  workouts: unknown[],
) {
  await seleccionarJson(hook, workouts);
  await act(async () => {
    await hook.current.confirmImport();
  });
}

async function importarDosVeces(
  hook: {
    current: {
      importFromJson: (e: ChangeEvent<HTMLInputElement>) => void;
      confirmImport: () => Promise<void>;
    };
  },
  workouts: unknown[],
) {
  await seleccionarJson(hook, workouts);
  await act(async () => {
    await Promise.all([hook.current.confirmImport(), hook.current.confirmImport()]);
  });
}

/** Claves que la "base" devolvería al empezar otra importación (vía RPC). */
function clavesEnBase() {
  return db.writtenItems().flatMap((item) => {
    const date = String(item.started_at ?? '').split('T')[0];
    const name = String(item.exercise_id ?? '').replace(/^ex-/, '');
    const sets = (item.sets ?? []) as { set_num: number }[];
    return sets.map((s) => ({ date, exercise: name, setNum: s.set_num }));
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

describe('useHistoryTransfer — importación JSON', () => {
  beforeEach(() => {
    db.reset();
    fileTexts.clear();
    lecturaEnCurso = Promise.resolve();
    toastMock.info.mockClear();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    fetchExercisesMock.mockReset();
    fetchExercisesMock.mockResolvedValue([]);
    fetchExistingSetKeysBetweenMock.mockReset();
    fetchExistingSetKeysBetweenMock.mockResolvedValue([]);
    refetchSetsMock.mockClear();
    refetchWorkoutsMock.mockClear();
    vi.stubGlobal('FileReader', FakeFileReader);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deduplica un JSON fuera de la ventana de 1000 entrenos sin llamar a la RPC', async () => {
    fetchExistingSetKeysBetweenMock.mockResolvedValue([
      { date: '2024-01-05', exercise: 'Sentadilla', setNum: 1 },
      { date: '2024-01-05', exercise: 'Sentadilla', setNum: 2 },
    ]);
    const { result } = renderTransfer([]);

    await importJson(result, [
      jsonWorkout('2024-01-05', [
        { exercise: 'Sentadilla', set_num: 1 },
        { exercise: 'Sentadilla', set_num: 2 },
      ]),
    ]);

    expect(fetchExistingSetKeysBetweenMock).toHaveBeenCalledWith(
      'user-1',
      '2024-01-05',
      '2024-01-05',
    );
    expect(db.rpcCalls).toEqual([]);
    expect(db.inserts).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:2'),
    );
  });

  it('consulta el rango completo que cubren los started_at', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer([]);

    await importJson(result, [
      jsonWorkout('2024-03-09', [{ exercise: 'Sentadilla' }]),
      jsonWorkout('2024-01-05', [{ exercise: 'Sentadilla' }]),
    ]);

    expect(fetchExistingSetKeysBetweenMock).toHaveBeenCalledWith(
      'user-1',
      '2024-01-05',
      '2024-03-09',
    );
    expect(db.rpcCalls).toHaveLength(1);
    expect((db.rpcCalls[0]?.args.p_workouts as unknown[]).length).toBe(2);
  });

  it('conserva el set_num explícito de la fila nueva que sigue a una duplicada', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockResolvedValue([
      { date: '2024-01-06', exercise: 'Sentadilla', setNum: 1 },
    ]);
    const { result } = renderTransfer([]);

    await importJson(result, [
      jsonWorkout('2024-01-06', [
        { exercise: 'Sentadilla', set_num: 1 },
        { exercise: 'Sentadilla', set_num: 3 },
      ]),
    ]);

    expect(db.rpcCalls).toHaveLength(1);
    const workouts = db.rpcCalls[0]?.args.p_workouts as { sets: { set_num: number }[] }[];
    expect(workouts[0]?.sets.map((s) => s.set_num)).toEqual([3]);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:1'),
    );
  });

  it('no crea ejercicios ni entrenos para un JSON enteramente duplicado', async () => {
    fetchExercisesMock.mockResolvedValue([]);
    fetchExistingSetKeysBetweenMock.mockResolvedValue([
      { date: '2024-01-07', exercise: 'Remo', setNum: 1 },
    ]);
    const { result } = renderTransfer([]);

    await importJson(result, [jsonWorkout('2024-01-07', [{ exercise: 'Remo', set_num: 1 }])]);

    expect(db.inserts).toEqual([]);
    expect(db.rpcCalls).toEqual([]);
  });

  it('reimportar el mismo JSON dos veces seguidas no duplica series', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => clavesEnBase());
    const { result } = renderTransfer([]);
    const workouts = [
      jsonWorkout('2024-01-08', [
        { exercise: 'Sentadilla', set_num: 1 },
        { exercise: 'Sentadilla', set_num: 2 },
      ]),
    ];

    await importJson(result, workouts);
    await importJson(result, workouts);

    expect(fetchExistingSetKeysBetweenMock).toHaveBeenCalledTimes(2);
    expect(db.rpcCalls).toHaveLength(1);
    // La segunda lectura del rango ya ve las dos series de la primera.
    expect(clavesEnBase()).toHaveLength(2);
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:2'),
    );
  });

  it('si la consulta del rango falla, importa igual y lo deja en consola', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockRejectedValue(new Error('sin permisos'));
    const { result } = renderTransfer([]);

    await importJson(result, [jsonWorkout('2024-02-01', [{ exercise: 'Sentadilla' }])]);

    expect(db.rpcCalls).toHaveLength(1);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:1'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('claves existentes del rango'),
      expect.any(Error),
    );
  });

  it('dos importaciones a la vez se turnan: la segunda ve lo que escribió la primera', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const lecturas: number[] = [];
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => {
      const claves = clavesEnBase();
      lecturas.push(claves.length);
      return claves;
    });
    const { result } = renderTransfer([]);

    await importarDosVeces(result, [
      jsonWorkout('2024-04-01', [
        { exercise: 'Sentadilla', set_num: 1 },
        { exercise: 'Sentadilla', set_num: 2 },
      ]),
    ]);

    expect(lecturas).toEqual([0, 2]);
    expect(db.rpcCalls).toHaveLength(1);
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:2'),
    );
  });

  it('con Web Locks las importaciones JSON no se solapan', async () => {
    const { estado } = instalarWebLocksFalsos();
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => clavesEnBase());
    const { result } = renderTransfer([]);

    await importarDosVeces(result, [
      jsonWorkout('2024-05-01', [{ exercise: 'Sentadilla', set_num: 1 }]),
    ]);

    expect(estado.maxConcurrentes).toBe(1);
    expect(db.rpcCalls).toHaveLength(1);
  });

  it('persiste todos los días y ejercicios en una sola RPC atómica', async () => {
    fetchExercisesMock.mockResolvedValue([
      { id: 'ex-sentadilla', name: 'Sentadilla' },
      { id: 'ex-press', name: 'Press banca' },
    ]);
    const { result } = renderTransfer([]);

    await importJson(result, [
      jsonWorkout('2024-07-01', [
        { exercise: 'Sentadilla', set_num: 1 },
        { exercise: 'Sentadilla', set_num: 2 },
        { exercise: 'Press banca', set_num: 1 },
      ]),
      jsonWorkout('2024-07-02', [{ exercise: 'Sentadilla', set_num: 1 }]),
    ]);

    expect(db.rpcCalls).toHaveLength(1);
    expect(db.rpcCalls[0]?.fn).toBe('import_history_workouts');
    expect((db.rpcCalls[0]?.args.p_workouts as unknown[]).length).toBe(3);
    expect(db.writtenItems()).toHaveLength(3);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:2'),
    );
  });

  it('un fallo antes de persistir no deja nada y un reintento manual vuelve a intentarlo', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer([]);
    const workouts = [jsonWorkout('2024-07-03', [{ exercise: 'Sentadilla', set_num: 1 }])];

    db.failNext();
    await importJson(result, workouts);

    expect(db.rpcCalls).toHaveLength(1);
    expect(db.writtenItems()).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith('history.import_error');

    await importJson(result, workouts);

    expect(db.rpcCalls).toHaveLength(2);
    expect(db.writtenItems()).toHaveLength(1);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:1'),
    );
  });

  it('un ejercicio irresoluble no bloquea los válidos y se informa como pendiente', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    db.failExerciseInsert();
    const { result } = renderTransfer([]);

    await importJson(result, [
      jsonWorkout('2024-07-07', [
        { exercise: 'Sentadilla', set_num: 1 },
        { exercise: 'Ejercicio irresoluble', set_num: 1 },
      ]),
    ]);

    // El lote que llega al servidor contiene solo lo que se pudo resolver: la
    // RPC sigue siendo atómica para ese subconjunto y el resto se declara como
    // pendiente en el mensaje, no como importado.
    expect(db.rpcCalls).toHaveLength(1);
    const payload = db.rpcCalls[0]?.args.p_workouts as { exercise_id: string }[];
    expect(payload).toHaveLength(1);
    expect(payload[0]?.exercise_id).toBe('ex-sentadilla');
    expect(db.writtenItems()).toHaveLength(1);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_failed:1'),
    );
  });

  it('una respuesta perdida reutiliza la identidad y no duplica el lote', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer([]);
    db.loseNextResponse();

    await importJson(result, [
      jsonWorkout('2024-07-04', [
        { exercise: 'Sentadilla', set_num: 1 },
        { exercise: 'Sentadilla', set_num: 2 },
      ]),
    ]);

    expect(db.rpcCalls).toHaveLength(2);
    expect(db.importIds()).toHaveLength(2);
    expect(db.importIds()[0]).toBe(db.importIds()[1]);
    expect(db.writtenItems()).toHaveLength(1);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:1'),
    );
  });

  it('un conflicto de idempotencia no se reintenta y se informa como conflicto', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer([]);
    db.conflictNext();

    await importJson(result, [jsonWorkout('2024-07-05', [{ exercise: 'Sentadilla', set_num: 1 }])]);

    expect(db.rpcCalls).toHaveLength(1);
    expect(db.writtenItems()).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith('history.import_conflict');
  });

  it('una nueva importación del mismo día recibe una identidad distinta', async () => {
    fetchExercisesMock.mockResolvedValue([
      { id: 'ex-sentadilla', name: 'Sentadilla' },
      { id: 'ex-remo', name: 'Remo' },
    ]);
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => clavesEnBase());
    const { result } = renderTransfer([]);

    await importJson(result, [jsonWorkout('2024-07-06', [{ exercise: 'Sentadilla', set_num: 1 }])]);
    await importJson(result, [jsonWorkout('2024-07-06', [{ exercise: 'Remo', set_num: 1 }])]);

    expect(db.importIds()).toHaveLength(2);
    expect(db.importIds()[0]).not.toBe(db.importIds()[1]);
    expect(db.writtenItems()).toHaveLength(2);
  });
});
