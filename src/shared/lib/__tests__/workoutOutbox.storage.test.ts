// @vitest-environment jsdom
// Resiliencia de la cola offline cuando IndexedDB no está disponible.
//
// Qué se fija aquí:
//  - un fallo de apertura no se cachea: cuando el almacenamiento vuelve, el
//    siguiente uso reintenta en vez de heredar el rechazo hasta recargar;
//  - el contador y el flush no revientan a quien los llama desde la interfaz;
//  - `enqueueWorkout` sí avisa (es la única señal de que el entreno no se
//    guardó en ningún sitio), y también se recupera.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const idb = vi.hoisted(() => ({ openDB: vi.fn() }));

vi.mock('idb', () => ({ openDB: idb.openDB }));
vi.mock('../supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

function fakeDb(rows: unknown[] = []) {
  return {
    getAll: vi.fn(async () => rows),
    count: vi.fn(async () => rows.length),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

function entrada() {
  return {
    id: 'e-1',
    userId: 'user-1',
    exerciseId: 'ex-1',
    customExerciseName: '',
    customMuscleGroup: '',
    startedAt: '2026-06-20T10:00:00.000Z',
    finishedAt: '2026-06-20T10:30:00.000Z',
    sets: [],
    createdAt: '2026-06-20T10:30:00.000Z',
  };
}

async function cargarOutbox() {
  vi.resetModules();
  return import('../workoutOutbox');
}

describe('workoutOutbox — almacenamiento no disponible', () => {
  beforeEach(() => {
    idb.openDB.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no cachea el fallo de apertura: el siguiente uso reintenta y funciona', async () => {
    const { countPendingWorkouts } = await cargarOutbox();
    idb.openDB
      .mockRejectedValueOnce(new Error('IndexedDB denegado'))
      .mockResolvedValueOnce(fakeDb([{}, {}]));

    // Primer uso: no hay almacenamiento. El contador de la interfaz no revienta.
    await expect(countPendingWorkouts()).resolves.toBe(0);
    expect(idb.openDB).toHaveBeenCalledTimes(1);

    // El almacenamiento vuelve (o el usuario concede permiso): se reintenta.
    await expect(countPendingWorkouts()).resolves.toBe(2);
    expect(idb.openDB).toHaveBeenCalledTimes(2);
  });

  it('mantiene cacheada la apertura que sí funcionó', async () => {
    const { countPendingWorkouts } = await cargarOutbox();
    idb.openDB.mockResolvedValue(fakeDb([]));

    await Promise.all([countPendingWorkouts(), countPendingWorkouts()]);
    await countPendingWorkouts();

    expect(idb.openDB).toHaveBeenCalledTimes(1);
  });

  it('el flush resuelve 0 en vez de rechazar cuando la cola no se puede abrir', async () => {
    const { flushWorkoutOutbox } = await cargarOutbox();
    idb.openDB.mockRejectedValue(new Error('sin IndexedDB'));

    // Corre al arrancar y en `online`: nadie lo espera para contarlo.
    await expect(flushWorkoutOutbox()).resolves.toBe(0);
    expect(console.error).toHaveBeenCalled();
  });

  it('enqueueWorkout avisa del fallo y se recupera en el siguiente intento', async () => {
    const { enqueueWorkout } = await cargarOutbox();
    idb.openDB.mockRejectedValueOnce(new Error('cuota llena'));

    await expect(enqueueWorkout(entrada())).rejects.toThrow('cuota llena');

    const db = fakeDb();
    idb.openDB.mockResolvedValueOnce(db);
    await expect(enqueueWorkout(entrada())).resolves.toBeUndefined();
    expect(db.put).toHaveBeenCalledTimes(1);
  });
});
