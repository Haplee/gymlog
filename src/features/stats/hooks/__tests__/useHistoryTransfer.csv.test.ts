// @vitest-environment jsdom
// Ruta CSV de `useHistoryTransfer`. La importación Excel tiene sus pruebas, pero
// el CSV entra por otro sitio del hook: contador de set_num propio, resolución
// de ejercicio por nombre y creación diferida del entreno. Estos tests fijan
// ese contrato y el orden en que se descartan las filas.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeEvent } from 'react';
import type { WorkoutWithSets } from '@shared/lib/types';

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
  let loseNextResponse = false;
  let seq = 0;

  // Servidor de mentira para la RPC: guarda por `p_client_id` y devuelve el
  // mismo entreno si la clave se reenvía. Es el contrato que el cliente necesita
  // para que un reintento de red no duplique, sin fingir que un `.insert()`
  // suelto sigue siendo el camino de guardado.
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

    // «El servidor escribió y la respuesta se perdió»: la siguiente llamada con
    // la misma clave tiene que encontrar el entreno ya creado.
    if (loseNextResponse) {
      loseNextResponse = false;
      throw new TypeError('Failed to fetch');
    }
    return { data: id, error: null };
  };

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
        if (failTables.has(table)) {
          return { data: null, error: new Error(`fallo simulado en ${table}`) };
        }
        if (table === 'exercises') {
          return { data: { id: `ex-${String(ultimo.name ?? '').toLowerCase()}` }, error: null };
        }
        return { data: null, error: null };
      },
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
    loseNextResponse: () => {
      loseNextResponse = true;
    },
    reset() {
      inserts.length = 0;
      workouts.length = 0;
      rpcCalls.length = 0;
      failTables.clear();
      failRpc = false;
      loseNextResponse = false;
      seq = 0;
    },
  };
});

const {
  toastMock,
  tMock,
  fetchExercisesMock,
  fetchExistingSetKeysBetweenMock,
  refetchSetsMock,
  refetchWorkoutsMock,
} = vi.hoisted(() => {
  const t = (key: string, opts?: { count?: number }) =>
    opts && opts.count !== undefined ? `${key}:${opts.count}` : key;
  return {
    tMock: t,
    toastMock: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
    fetchExercisesMock: vi.fn(),
    fetchExistingSetKeysBetweenMock: vi.fn(),
    refetchSetsMock: vi.fn().mockResolvedValue(undefined),
    refetchWorkoutsMock: vi.fn().mockResolvedValue(undefined),
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

/* -------------------------------------------------------------- helpers --- */

/** Workouts ya en BD, en la forma que consume `buildExistingDedupKeys`. */
function existingWorkouts(
  rows: { date: string; exercise: string; setNum: number }[],
): WorkoutWithSets[] {
  return rows.map((row, i) => ({
    id: `w-${i}`,
    started_at: `${row.date}T10:00:00.000Z`,
    sets: [{ id: `s-${i}`, set_num: row.setNum, exercise: { name: row.exercise } }],
  })) as unknown as WorkoutWithSets[];
}

function renderTransfer(workouts: WorkoutWithSets[] = []) {
  return renderHook(() =>
    useHistoryTransfer({
      workouts,
      refetchSets: refetchSetsMock,
      refetchWorkouts: refetchWorkoutsMock,
    }),
  );
}

async function importCsv(
  hook: { current: { importFromCsv: (e: ChangeEvent<HTMLInputElement>) => void } },
  content: string,
  name = 'historial.csv',
) {
  const file = new File([content], name, { type: 'text/csv' });
  fileTexts.set(file, content);
  const event = { target: { files: [file], value: 'elegido.csv' } };

  act(() => hook.current.importFromCsv(event as unknown as ChangeEvent<HTMLInputElement>));
  await act(async () => {
    await lecturaEnCurso;
  });
}

const insertsDe = (table: string) => db.inserts.filter((i) => i.table === table);
/** Series de todos los entrenos guardados, en el orden en que se escribieron. */
const setsGuardadas = () => db.workouts.flatMap((w) => w.sets);

/**
 * Lo que el mock de la consulta por rango devuelve: las claves que ya se
 * guardaron en este test, como las vería la base al empezar otra importación.
 */
function clavesEnBase() {
  return db.workouts.flatMap((w) =>
    w.sets.map((s) => ({
      date: w.started_at,
      exercise: 'Sentadilla',
      setNum: Number(s.set_num),
    })),
  );
}

/** Ejecuta dos importaciones del mismo fichero sin esperar la primera. */
async function importarDosVeces(
  hook: { current: { importFromCsv: (e: ChangeEvent<HTMLInputElement>) => void } },
  content: string,
) {
  const file = new File([content], 'historial.csv', { type: 'text/csv' });
  fileTexts.set(file, content);
  const event = { target: { files: [file], value: 'elegido.csv' } };
  const lecturas: Promise<unknown>[] = [];

  act(() => {
    hook.current.importFromCsv(event as unknown as ChangeEvent<HTMLInputElement>);
    lecturas.push(lecturaEnCurso);
    hook.current.importFromCsv(event as unknown as ChangeEvent<HTMLInputElement>);
    lecturas.push(lecturaEnCurso);
  });

  await act(async () => {
    await Promise.all(lecturas);
  });
}

/** Web Locks falso: serializa como el real y anota la concurrencia máxima. */
function instalarWebLocksFalsos() {
  let cadena: Promise<unknown> = Promise.resolve();
  let enCurso = 0;
  const estado = { maxConcurrentes: 0 };
  const request = vi.fn((_nombre: string, tarea: () => Promise<unknown>) => {
    const run = cadena.then(
      async () => {
        enCurso += 1;
        estado.maxConcurrentes = Math.max(estado.maxConcurrentes, enCurso);
        try {
          return await tarea();
        } finally {
          enCurso -= 1;
        }
      },
      async () => {
        enCurso += 1;
        estado.maxConcurrentes = Math.max(estado.maxConcurrentes, enCurso);
        try {
          return await tarea();
        } finally {
          enCurso -= 1;
        }
      },
    );
    cadena = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  });
  vi.stubGlobal('navigator', { onLine: true, locks: { request } });
  return { request, estado };
}

describe('useHistoryTransfer — importación CSV', () => {
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

  it('reimportar filas ya importadas no crea entrenos ni series', async () => {
    const { result } = renderTransfer(
      existingWorkouts([
        { date: '2026-08-01', exercise: 'Sentadilla', setNum: 1 },
        { date: '2026-08-01', exercise: 'Press banca', setNum: 1 },
      ]),
    );

    await importCsv(result, '2026-08-01,Sentadilla,5,100\n2026-08-01,Press banca,8,60');

    // Se llegó al bucle de filas: si no, el test pasaría por el motivo erróneo.
    expect(fetchExercisesMock).toHaveBeenCalled();
    expect(db.rpcCalls).toEqual([]);
    expect(db.workouts).toEqual([]);
    expect(setsGuardadas()).toEqual([]);
    // Nada guardado: se avisa por error y no se refresca la pantalla.
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('history.import_none'));
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(refetchSetsMock).not.toHaveBeenCalled();
    expect(refetchWorkoutsMock).not.toHaveBeenCalled();
  });

  it('las filas descartadas por duplicadas no crean ejercicios en el catálogo', async () => {
    // El nombre está en el historial pero no en el catálogo cargado (la lista de
    // ejercicios y los entrenos son fuentes distintas). Si se resuelve antes de
    // deduplicar, se crea un ejercicio que no usa ninguna serie.
    fetchExercisesMock.mockResolvedValue([]);
    const { result } = renderTransfer([
      ...existingWorkouts([
        { date: '2026-08-01', exercise: 'Sentadilla', setNum: 1 },
        { date: '2026-08-01', exercise: 'Sentadilla', setNum: 2 },
      ]),
    ]);

    await importCsv(result, '2026-08-01,Sentadilla,5,100\n2026-08-01,Sentadilla,5,105');

    expect(fetchExercisesMock).toHaveBeenCalled();
    expect(insertsDe('exercises')).toEqual([]);
    expect(db.inserts).toEqual([]);
    expect(db.rpcCalls).toEqual([]);
    expect(db.workouts).toEqual([]);
  });

  it('conserva el set_num de la fila nueva que sigue a una deduplicada', async () => {
    const { result } = renderTransfer(
      existingWorkouts([{ date: '2026-08-02', exercise: 'Sentadilla', setNum: 1 }]),
    );

    // Dos filas del mismo ejercicio y día: la primera ya existe, la segunda no.
    await importCsv(result, '2026-08-02,Sentadilla,5,100\n2026-08-02,Sentadilla,5,105');

    expect(fetchExercisesMock).toHaveBeenCalled();
    const sets = setsGuardadas();
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ set_num: 2, weight: 105, reps: 5 });
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:1'),
    );
  });

  it('crea el entreno de cada fecha solo cuando hay una serie real que insertar', async () => {
    const { result } = renderTransfer();
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);

    await importCsv(result, '2026-08-03,Sentadilla,5,100\n2026-08-04,Sentadilla,5,105');

    expect(fetchExercisesMock).toHaveBeenCalled();
    // Un lote (RPC) por fecha, cada uno con su serie.
    expect(db.rpcCalls).toHaveLength(2);
    expect(db.rpcCalls.map((c) => c.args.p_started_at)).toEqual(['2026-08-03', '2026-08-04']);
    expect(db.rpcCalls.map((c) => (c.args.p_sets as unknown[]).length)).toEqual([1, 1]);
  });

  it('no resuelve ni crea el ejercicio de una fila sin peso', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer();

    // La fila de Zancada se descarta por peso 0: no debe dejar rastro en el
    // catálogo. La de Sentadilla sí entra.
    await importCsv(result, '2026-08-05,Zancada,10,0\n2026-08-05,Sentadilla,5,100');

    expect(fetchExercisesMock).toHaveBeenCalled();
    expect(insertsDe('exercises')).toEqual([]);
    expect(setsGuardadas()).toHaveLength(1);
    expect(db.rpcCalls).toHaveLength(1);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:1'),
    );
  });

  it('un fichero vacío se rechaza antes de tocar la base de datos', async () => {
    const { result } = renderTransfer();

    await importCsv(result, '\n\n');

    expect(fetchExercisesMock).not.toHaveBeenCalled();
    expect(db.inserts).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith('history.file_empty');
  });

  it('un fichero de una sola línea no abre nada', async () => {
    const { result } = renderTransfer();

    await importCsv(result, '2026-08-06,Sentadilla,5,100');

    expect(fetchExercisesMock).not.toHaveBeenCalled();
    expect(db.inserts).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith('history.file_insufficient');
  });

  it('si no se puede guardar el lote, no deja la serie suelta y lo notifica', async () => {
    db.failRpc();
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer();

    await importCsv(result, '2026-08-06,Sentadilla,5,100\n2026-08-06,Sentadilla,5,105');

    // Una transacción por día: si la RPC falla, no hay entreno ni series.
    expect(db.workouts).toEqual([]);
    expect(setsGuardadas()).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('history.import_skipped:2'),
    );
    expect(refetchSetsMock).not.toHaveBeenCalled();
  });

  it('una respuesta perdida se reintenta con la misma clave y no duplica el día', async () => {
    // El servidor escribe el lote y se pierde la respuesta. El reintento trae la
    // misma clave: el servidor devuelve el entreno original en vez de crear otro.
    db.loseNextResponse();
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer();

    await importCsv(result, '2026-08-09,Sentadilla,5,100\n2026-08-09,Sentadilla,5,105');

    expect(db.rpcCalls).toHaveLength(2);
    expect(db.rpcCalls[1]?.args.p_client_id).toBe(db.rpcCalls[0]?.args.p_client_id);
    expect(db.workouts).toHaveLength(1);
    expect(setsGuardadas()).toHaveLength(2);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:2'),
    );
  });

  it('dos importaciones manuales del mismo día usan identidades distintas', async () => {
    // La primera importación escribe la serie 1. La segunda repite esa fila y
    // añade la 2: el dedupe de contenido salta la primera, pero el lote nuevo se
    // envía con una clave derivada de OTRA identidad de importación. Si ambas
    // compartieran identidad, el servidor devolvería el entreno anterior y la
    // serie 2 se perdería como si ya estuviera guardada.
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => clavesEnBase());
    const { result } = renderTransfer([]);

    await importCsv(result, '2024-07-01,Sentadilla,5,100\n2024-07-01,Sentadilla,5,105');
    await importCsv(
      result,
      '2024-07-01,Sentadilla,5,100\n2024-07-01,Sentadilla,5,105\n2024-07-01,Sentadilla,5,110',
    );

    expect(db.rpcCalls).toHaveLength(2);
    const [primera, segunda] = db.rpcCalls;
    expect(segunda?.args.p_client_id).not.toBe(primera?.args.p_client_id);
    expect(segunda?.args.p_sets).toHaveLength(1);
    expect(segunda?.args.p_sets).toEqual([
      expect.objectContaining({ set_num: 3, reps: 5, weight: 110 }),
    ]);
    expect(db.workouts).toHaveLength(2);
    expect(setsGuardadas()).toHaveLength(3);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:1'),
    );
  });

  it('si el ejercicio no se puede crear, no abre entreno y lo cuenta como error', async () => {
    db.failTable('exercises');
    fetchExercisesMock.mockResolvedValue([]);
    const { result } = renderTransfer();

    await importCsv(result, '2026-08-07,Sentadilla,5,100\n2026-08-07,Sentadilla,5,105');

    expect(db.workouts).toEqual([]);
    expect(setsGuardadas()).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('history.import_skipped:2'),
    );
  });

  it('una importación mixta guarda lo nuevo y no toca el catálogo por lo duplicado', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-press', name: 'Press banca' }]);
    const { result } = renderTransfer(
      existingWorkouts([{ date: '2026-08-08', exercise: 'Sentadilla', setNum: 1 }]),
    );

    await importCsv(result, '2026-08-08,Sentadilla,5,100\n2026-08-08,Press banca,8,60');

    expect(fetchExercisesMock).toHaveBeenCalled();
    // `Sentadilla` iba en el historial pero no en el catálogo: no se crea.
    expect(insertsDe('exercises')).toEqual([]);
    expect(db.rpcCalls).toHaveLength(1);
    expect(setsGuardadas()[0]).toMatchObject({
      exercise_id: 'ex-press',
      set_num: 1,
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:1'),
    );
    expect(refetchSetsMock).toHaveBeenCalled();
  });

  it('deduplica una fecha más antigua que la ventana de historial cargada', async () => {
    // `workouts` es la ventana de `fetchWorkouts` (1000 entrenos): aquí no hay
    // nada, así que sin consultar el rango la reimportación duplicaría.
    fetchExistingSetKeysBetweenMock.mockResolvedValue([
      { date: '2024-01-05', exercise: 'Sentadilla', setNum: 1 },
      { date: '2024-01-05', exercise: 'Sentadilla', setNum: 2 },
    ]);
    const { result } = renderTransfer([]);

    await importCsv(result, '2024-01-05,Sentadilla,5,100\n2024-01-05,Sentadilla,5,105');

    expect(fetchExistingSetKeysBetweenMock).toHaveBeenCalledWith(
      'user-1',
      '2024-01-05',
      '2024-01-05',
    );
    expect(db.workouts).toEqual([]);
    expect(db.rpcCalls).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('history.import_none'));
  });

  it('pide el rango de fechas completo del fichero, no solo la primera', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    const { result } = renderTransfer([]);

    // Fechas en formato dd/mm/yyyy: el rango se calcula con lo que parsea el
    // importador, no buscando texto con forma de ISO.
    await importCsv(result, '05/01/2024,Sentadilla,5,100\n9/3/2024,Sentadilla,5,105');

    expect(fetchExistingSetKeysBetweenMock).toHaveBeenCalledWith(
      'user-1',
      '2024-01-05',
      '2024-03-09',
    );
    expect(setsGuardadas()).toHaveLength(2);
  });

  it('si la consulta del rango falla, importa igual y lo deja en consola', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockRejectedValue(new Error('sin permisos'));
    const { result } = renderTransfer([]);

    await importCsv(result, '2024-02-01,Sentadilla,5,100\n2024-02-02,Sentadilla,5,105');

    // No se aborta la importación por no poder leer el histórico: se degrada a
    // deduplicar contra la ventana.
    expect(setsGuardadas()).toHaveLength(2);
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('history.import_success:2'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('claves existentes del rango'),
      expect.any(Error),
    );
  });

  it('dos importaciones a la vez se turnan: la segunda ve lo que insertó la primera', async () => {
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    // Se lee la "base" en el momento de la consulta y se anota cuántas series
    // había: sin turno, las dos leen cero y las dos insertan.
    const lecturas: string[] = [];
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => {
      const claves = clavesEnBase();
      lecturas.push(`rango con ${claves.length} serie(s)`);
      return claves;
    });
    const { result } = renderTransfer([]);

    await importarDosVeces(result, '2024-03-01,Sentadilla,5,100\n2024-03-01,Sentadilla,5,105');

    expect(fetchExercisesMock).toHaveBeenCalledTimes(2);
    // La primera importación encuentra la base vacía y entra con sus 2 series;
    // la segunda arranca después y las ve: sin turno habría leído 0 y duplicado.
    expect(lecturas).toEqual(['rango con 0 serie(s)', 'rango con 2 serie(s)']);
    expect(db.workouts).toHaveLength(1);
    expect(setsGuardadas()).toHaveLength(2);
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('history.import_duplicates_skipped:2'),
    );
  });

  it('con Web Locks el turno es por origen (dos pestañas), no solo por pestaña', async () => {
    const { request, estado } = instalarWebLocksFalsos();
    fetchExercisesMock.mockResolvedValue([{ id: 'ex-sentadilla', name: 'Sentadilla' }]);
    fetchExistingSetKeysBetweenMock.mockImplementation(async () => clavesEnBase());
    const { result } = renderTransfer([]);

    await importarDosVeces(result, '2024-04-01,Sentadilla,5,100\n2024-04-01,Sentadilla,5,105');

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe('gymlog-history-import');
    expect(estado.maxConcurrentes).toBe(1);
    expect(setsGuardadas()).toHaveLength(2);
  });
});
