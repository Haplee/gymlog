import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@shared/lib/supabase', () => ({ supabase: { from: vi.fn() } }));

import { useCardioStore, type CardioSession } from '../cardioStore';
import { supabase } from '@shared/lib/supabase';

const mockFrom = vi.mocked(supabase.from);

/** Cadena de stopSession: .upsert(...).select('id').single() */
function mockStopChain(result: { data: { id: string } | null; error: { message: string } | null }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  mockFrom.mockImplementation(() => ({ upsert }) as unknown as ReturnType<typeof supabase.from>);
  return { upsert };
}

interface RemoteRow {
  id: string;
  type: string;
  started_at: string;
  duration: number;
  distance?: number | null;
  calories?: number | null;
  notes?: string | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  source?: string | null;
}

/**
 * Cadena de syncFromRemote:
 *  lectura: .select(cols).eq().order().limit()
 *  push:    .upsert(rows, opts).select(cols)
 */
function mockSyncChain(
  readResult: { data: RemoteRow[] | null; error: { message: string } | null },
  pushResult: { data: RemoteRow[] | null; error: { message: string } | null } = {
    data: [],
    error: null,
  },
  deleteResult: { error: { message: string } | null } = { error: null },
) {
  const limit = vi.fn().mockResolvedValue(readResult);
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const upsertSelect = vi.fn().mockResolvedValue(pushResult);
  const upsert = vi.fn(() => ({ select: upsertSelect }));
  const deleteEq = vi.fn().mockResolvedValue(deleteResult);
  const del = vi.fn(() => ({ eq: deleteEq }));
  mockFrom.mockImplementation(
    () => ({ select, upsert, delete: del }) as unknown as ReturnType<typeof supabase.from>,
  );
  return { upsert, del, deleteEq };
}

/** Cadena de deleteSession: .delete().eq() */
function mockDeleteChain(result: { error: { message: string } | null }) {
  const deleteEq = vi.fn().mockResolvedValue(result);
  const del = vi.fn(() => ({ eq: deleteEq }));
  mockFrom.mockImplementation(
    () => ({ delete: del }) as unknown as ReturnType<typeof supabase.from>,
  );
  return { del, deleteEq };
}

function makeSession(overrides: Partial<CardioSession> = {}): CardioSession {
  return {
    id: 'local-1',
    type: 'running',
    startedAt: '2026-07-11T10:00:00.123Z',
    duration: 600,
    ...overrides,
  };
}

const initialState = {
  isActive: false,
  isPaused: false,
  activeType: null,
  startedAt: null,
  pausedAt: null,
  pausedDuration: 0,
  sessions: [] as CardioSession[],
  pendingDeletes: [] as string[],
};

describe('useCardioStore', () => {
  beforeEach(() => {
    useCardioStore.setState(initialState);
    mockFrom.mockReset();
    // Los caminos de error logean via devError/devWarn — silenciados.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getElapsed', () => {
    it('descuenta el tiempo en pausa', () => {
      const store = useCardioStore.getState();
      store.startSession('running');

      vi.advanceTimersByTime(30_000);
      useCardioStore.getState().pauseSession();
      vi.advanceTimersByTime(20_000);
      expect(useCardioStore.getState().getElapsed()).toBe(30);

      useCardioStore.getState().resumeSession();
      vi.advanceTimersByTime(10_000);
      expect(useCardioStore.getState().getElapsed()).toBe(40);
    });

    it('devuelve 0 sin sesión activa', () => {
      expect(useCardioStore.getState().getElapsed()).toBe(0);
    });
  });

  describe('stopSession', () => {
    it('descarta sesiones de menos de 5 segundos sin tocar Supabase', async () => {
      useCardioStore.getState().startSession('running');
      vi.advanceTimersByTime(3_000);

      const session = await useCardioStore.getState().stopSession('user-1');

      expect(session).toBeNull();
      expect(mockFrom).not.toHaveBeenCalled();
      expect(useCardioStore.getState().isActive).toBe(false);
      expect(useCardioStore.getState().sessions).toHaveLength(0);
    });

    it('guarda online via upsert idempotente y adopta el id remoto', async () => {
      const { upsert } = mockStopChain({ data: { id: 'remote-id' }, error: null });
      useCardioStore.getState().startSession('cycling');
      vi.advanceTimersByTime(60_000);

      const session = await useCardioStore.getState().stopSession('user-1', { distance: 20 });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', type: 'cycling', duration: 60, distance: 20 }),
        { onConflict: 'user_id,started_at' },
      );
      expect(session?.id).toBe('remote-id');
      expect(session?.pendingSync).toBe(false);
      expect(useCardioStore.getState().sessions[0].id).toBe('remote-id');
    });

    it('marca pendingSync si el guardado remoto falla', async () => {
      mockStopChain({ data: null, error: { message: 'boom' } });
      useCardioStore.getState().startSession('running');
      vi.advanceTimersByTime(60_000);

      const session = await useCardioStore.getState().stopSession('user-1');

      expect(session?.pendingSync).toBe(true);
      expect(useCardioStore.getState().sessions[0].pendingSync).toBe(true);
    });

    it('marca pendingSync sin usuario y no llama a Supabase', async () => {
      useCardioStore.getState().startSession('running');
      vi.advanceTimersByTime(60_000);

      const session = await useCardioStore.getState().stopSession(null);

      expect(session?.pendingSync).toBe(true);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('syncFromRemote — deduplicación (regresión bug §4.1)', () => {
    it("no re-inserta una sesión local cuando el remoto la devuelve con offset '+00:00'", async () => {
      // Escenario del bug: el INSERT tuvo éxito pero se perdió la respuesta →
      // la sesión quedó local con id propio y timestamp '...Z'. El remoto
      // devuelve el MISMO instante como '...+00:00' (timestamptz) y otro id.
      // Con la comparación por string cruda esto re-insertaba un duplicado.
      const { upsert } = mockSyncChain({
        data: [
          {
            id: 'remote-id',
            type: 'running',
            started_at: '2026-07-11T10:00:00.123+00:00',
            duration: 600,
          },
        ],
        error: null,
      });
      useCardioStore.setState({
        sessions: [makeSession({ id: 'local-1', startedAt: '2026-07-11T10:00:00.123Z' })],
      });

      await useCardioStore.getState().syncFromRemote('user-1');

      expect(upsert).not.toHaveBeenCalled();
      const sessions = useCardioStore.getState().sessions;
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('remote-id');
    });

    it('empuja las sesiones pendingSync con upsert idempotente', async () => {
      const { upsert } = mockSyncChain(
        { data: [], error: null },
        {
          data: [
            {
              id: 'remote-new',
              type: 'running',
              started_at: '2026-07-11T10:00:00.123+00:00',
              duration: 600,
            },
          ],
          error: null,
        },
      );
      useCardioStore.setState({ sessions: [makeSession({ pendingSync: true })] });

      await useCardioStore.getState().syncFromRemote('user-1');

      expect(upsert).toHaveBeenCalledWith(
        [expect.objectContaining({ user_id: 'user-1', started_at: '2026-07-11T10:00:00.123Z' })],
        { onConflict: 'user_id,started_at' },
      );
      const sessions = useCardioStore.getState().sessions;
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('remote-new');
      expect(sessions[0].pendingSync).toBe(false);
    });

    it('conserva las pendientes como pendingSync si el push falla', async () => {
      mockSyncChain({ data: [], error: null }, { data: null, error: { message: 'push failed' } });
      useCardioStore.setState({ sessions: [makeSession({ pendingSync: true })] });

      await useCardioStore.getState().syncFromRemote('user-1');

      const sessions = useCardioStore.getState().sessions;
      expect(sessions).toHaveLength(1);
      expect(sessions[0].pendingSync).toBe(true);
    });

    it('no toca el estado local si la lectura remota falla', async () => {
      mockSyncChain({ data: null, error: { message: 'read failed' } });
      useCardioStore.setState({ sessions: [makeSession()] });

      await useCardioStore.getState().syncFromRemote('user-1');

      expect(useCardioStore.getState().sessions).toHaveLength(1);
      expect(useCardioStore.getState().sessions[0].id).toBe('local-1');
    });
  });

  describe('deleteSession — tombstone', () => {
    it('quita la sesión de la lista y borra el tombstone al confirmar el servidor', async () => {
      const { deleteEq } = mockDeleteChain({ error: null });
      useCardioStore.setState({ sessions: [makeSession({ id: 's1' })] });

      await useCardioStore.getState().deleteSession('s1', 'user-1');

      expect(deleteEq).toHaveBeenCalledWith('id', 's1');
      expect(useCardioStore.getState().sessions).toHaveLength(0);
      expect(useCardioStore.getState().pendingDeletes).toEqual([]);
    });

    it('conserva el tombstone si el borrado remoto falla', async () => {
      mockDeleteChain({ error: { message: 'boom' } });
      useCardioStore.setState({ sessions: [makeSession({ id: 's1' })] });

      await useCardioStore.getState().deleteSession('s1', 'user-1');

      expect(useCardioStore.getState().sessions).toHaveLength(0);
      expect(useCardioStore.getState().pendingDeletes).toEqual(['s1']);
    });

    it('sin usuario no llama a Supabase y deja el borrado pendiente', async () => {
      useCardioStore.setState({ sessions: [makeSession({ id: 's1' })] });

      await useCardioStore.getState().deleteSession('s1', null);

      expect(mockFrom).not.toHaveBeenCalled();
      expect(useCardioStore.getState().sessions).toHaveLength(0);
      expect(useCardioStore.getState().pendingDeletes).toEqual(['s1']);
    });
  });

  describe('syncFromRemote — tombstones', () => {
    it('reintenta el borrado pendiente y no resucita la fila remota', async () => {
      const { del, deleteEq } = mockSyncChain({
        data: [
          {
            id: 's1',
            type: 'running',
            started_at: '2026-07-11T10:00:00.123+00:00',
            duration: 600,
          },
        ],
        error: null,
      });
      useCardioStore.setState({ pendingDeletes: ['s1'] });

      await useCardioStore.getState().syncFromRemote('user-1');

      expect(del).toHaveBeenCalled();
      expect(deleteEq).toHaveBeenCalledWith('id', 's1');
      expect(useCardioStore.getState().sessions).toHaveLength(0);
      expect(useCardioStore.getState().pendingDeletes).toEqual([]);
    });

    it('mantiene el tombstone y oculta la fila si el reintento falla', async () => {
      mockSyncChain(
        {
          data: [
            {
              id: 's1',
              type: 'running',
              started_at: '2026-07-11T10:00:00.123+00:00',
              duration: 600,
            },
          ],
          error: null,
        },
        { data: [], error: null },
        { error: { message: 'sigue fallando' } },
      );
      useCardioStore.setState({ pendingDeletes: ['s1'] });

      await useCardioStore.getState().syncFromRemote('user-1');

      expect(useCardioStore.getState().sessions).toHaveLength(0);
      expect(useCardioStore.getState().pendingDeletes).toEqual(['s1']);
    });
  });
});
